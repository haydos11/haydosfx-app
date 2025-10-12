// app/(dashboard)/calendar/live-news/server/fetchFeeds.ts
import "server-only";
import { fetchRssFeeds } from "./fetchRss";
import { fetchMarketAux } from "./fetchMarketAux";
import { fetchPolygonNews } from "./fetchPolygonNews";

export type NormalizedItem = {
  id: string;
  title: string;
  url: string;             // direct source link (Polygon's article_url or RSS link)
  published_at: string;    // ISO
  summary: string;
  source: string;
  symbols?: string[];      // raw symbols from provider (e.g., ["AAPL","SPY","C:EURUSD","X:BTCUSD"])
  assets?: string[];       // inferred tags (e.g., ["US Equities","AAPL","EURUSD","Crypto","BTC"])
};

type NewsCache = { ts: number; items: NormalizedItem[] };
const G = globalThis as typeof globalThis & { __news_cache?: NewsCache };

const TTL = 5 * 60 * 1000; // 5 minutes in-memory cache for combined feed
const USE_POLYGON = !!process.env.POLYGON_API_KEY; // only call if key is present

function toValidISO(s: string | undefined): string {
  if (!s) return new Date().toISOString();
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

/**
 * Fetch combined live feeds. Safe to call frequently:
 * - Each source has its own internal pacing/caching.
 * - We also memoize the merged result for 5 minutes here.
 *
 * @param opts.maxItems Optional cap on returned items (after dedupe/sort)
 */
export async function fetchCombinedFeeds(opts?: { maxItems?: number }): Promise<NormalizedItem[]> {
  const now = Date.now();

  // serve from memo cache if fresh
  if (G.__news_cache && now - G.__news_cache.ts < TTL) {
    const cached = G.__news_cache.items;
    return typeof opts?.maxItems === "number" ? cached.slice(0, opts.maxItems) : cached;
  }

  try {
    const [rss, mx, poly] = await Promise.allSettled([
      fetchRssFeeds(),             // your RSS consolidator
      fetchMarketAux(3),           // marketaux (self-throttled inside)
      USE_POLYGON ? fetchPolygonNews(25) : Promise.resolve([] as NormalizedItem[]), // Polygon only if key present
    ]);

    const merged: NormalizedItem[] = [];

    if (rss.status === "fulfilled" && Array.isArray(rss.value)) {
      merged.push(...rss.value);
    }
    if (mx.status === "fulfilled" && Array.isArray(mx.value)) {
      merged.push(...mx.value);
    }
    if (poly.status === "fulfilled" && Array.isArray(poly.value)) {
      merged.push(...poly.value);
    }

    // Normalize dates (defensive) before sort
    for (const it of merged) {
      it.published_at = toValidISO(it.published_at);
    }

    // De-dupe: prefer URL, then ID (handle missing/null defensively)
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const deduped: NormalizedItem[] = [];

    for (const x of merged) {
      const id = (x.id ?? "").trim();
      const url = (x.url ?? "").trim().toLowerCase();

      // If both missing, skip (shouldn't happen, but be safe)
      if (!id && !url) continue;

      if (url) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
      }
      if (id) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }

      deduped.push(x);
    }

    // Newest first
    deduped.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    // Optional cap
    const items = typeof opts?.maxItems === "number" ? deduped.slice(0, opts.maxItems) : deduped;

    // Memoize
    G.__news_cache = { ts: now, items };
    return items;
  } catch (err) {
    // On error, fall back to previous cache if recent
    const cache = G.__news_cache;
    if (cache && now - cache.ts < TTL) {
      console.warn("[news] using cache due to error:", (err as Error)?.message);
      return typeof opts?.maxItems === "number" ? cache.items.slice(0, opts.maxItems) : cache.items;
    }
    console.warn("[news] no cache, returning empty:", (err as Error)?.message);
    return [];
  }
}
