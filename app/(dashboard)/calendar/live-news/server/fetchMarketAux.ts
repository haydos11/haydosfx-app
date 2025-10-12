// app/(dashboard)/calendar/live-news/server/fetchMarketAux.ts
import crypto from "crypto";
import type { NormalizedItem } from "./fetchFeeds";

/**
 * Zero-config pacing:
 * - Hits MarketAux at most every 15 minutes
 * - Hard caps at ~96 calls/day (well under free 100/day)
 * - Returns [] when pacing says "not now", so it's safe to call every cycle
 */

const MIN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DAILY_LIMIT     = 96;             // < 100/day free tier
const LIMIT_PER_CALL  = 3;              // free tier returns 3 articles/request
const COUNTRIES       = "us,gb,eu,au";
const LANGUAGE        = "en";

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

/** Global in-memory pacing (per server instance) */
type Pace = { lastTs?: number; dayKey?: string; count?: number };
const G = globalThis as typeof globalThis & { __mx_pace?: Pace };
G.__mx_pace ||= {};

/** YYYY-MM-DD in UTC */
function utcDayKey(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/** Small random jitter ±30s so multiple instances don't all hit at once */
function jitterMs(): number {
  const J = 30_000;
  return Math.floor((Math.random() - 0.5) * 2 * J);
}

type MarketAuxArticle = {
  uuid: string;
  title: string;
  description: string | null;
  url: string;
  source: string;
  published_at: string;
};
type MarketAuxResponse = { data: MarketAuxArticle[] };

function toItem(a: MarketAuxArticle): NormalizedItem {
  return {
    id: a.uuid || sha1(`${a.url}|${a.published_at || ""}`),
    title: a.title,
    url: a.url,
    source: a.source || "MarketAux",
    summary: a.description ?? "",
    published_at: a.published_at || new Date().toISOString(),
  };
}

/** simple in-memory pacing gate */
function allowAndMark(): boolean {
  const now = Date.now();
  const day = utcDayKey();

  const p = (G.__mx_pace ||= {});
  if (p.dayKey !== day) { p.dayKey = day; p.count = 0; }

  if (p.lastTs && now - p.lastTs < MIN_INTERVAL_MS) return false;
  if ((p.count ?? 0) >= DAILY_LIMIT) return false;

  p.lastTs = now;
  p.count = (p.count ?? 0) + 1;
  return true;
}

/** Public fetcher: safe to call every cycle; it self-throttles. */
export async function fetchMarketAux(limit = LIMIT_PER_CALL): Promise<NormalizedItem[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) {
    // No key? Just noop so the rest of your pipeline keeps working.
    return [];
  }
  // Pacing guard
  if (!allowAndMark()) return [];

  // Optional jitter
  const j = jitterMs();
  if (Math.abs(j) > 0) await new Promise(r => setTimeout(r, Math.max(0, j)));

  const qs = new URLSearchParams({
    api_token: apiKey,
    limit: String(limit),
    countries: COUNTRIES,
    language: LANGUAGE,
    publisher: "top",
  });

  const url = `https://api.marketaux.com/v1/news/all?${qs}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn("[MarketAux]", res.status, await res.text());
      return [];
    }
    const json = (await res.json()) as MarketAuxResponse;
    return (json.data || []).map(toItem);
  } catch (e) {
    console.warn("[MarketAux] fetch error:", (e as Error)?.message ?? e);
    return [];
  }
}
