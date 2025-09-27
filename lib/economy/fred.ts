// lib/economy/fred.ts

export const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export type FredPoint = { date: string; value: number };

const toNum = (v: string): number => (v === "." ? NaN : Number(v));

type FetchFredOptions = {
  /** FRED API key (required). Keep server-side. */
  apiKey: string;
  /** ISO date like 1990-01-01 */
  start: string;
  /** ISO date like 2025-12-31 */
  end: string;
  /** Vercel/Next revalidate seconds for CDN caching. Default: 3600 (1 hour) */
  revalidate?: number;
  /** Number of retry attempts on network/5xx errors. Default: 1 (no extra retries) */
  retries?: number;
  /** Per-request timeout in ms (aborts the fetch). Default: 10000 (10s) */
  timeoutMs?: number;
  /** Extra FRED query params (rarely needed). e.g., { units: "pc1" } */
  params?: Record<string, string | number | boolean | undefined>;
};

function buildFredUrl(id: string, { apiKey, start, end, params }: FetchFredOptions) {
  const u = new URL(FRED_BASE);
  u.searchParams.set("series_id", id);
  u.searchParams.set("api_key", apiKey);
  u.searchParams.set("file_type", "json");
  u.searchParams.set("observation_start", start);
  u.searchParams.set("observation_end", end);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

async function fetchOnce(url: string, { revalidate = 3600, timeoutMs = 10_000 }: FetchFredOptions): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { next: { revalidate }, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithRetry(url: string, opts: FetchFredOptions): Promise<Response> {
  const retries = Math.max(0, opts.retries ?? 1);
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    try {
      const res = await fetchOnce(url, opts);
      // Retry only on network errors/5xx. 4xx is a hard failure (bad series id, etc.)
      if (!res.ok && res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      // simple backoff: 200ms, 400ms, 800ms...
      const delay = 200 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** ---- FRED response typing & guard ---- */
type FredObservationRaw = { date?: unknown; value?: unknown };
type FredResponseRaw = { observations?: unknown };

function parseFredResponse(json: unknown): FredPoint[] {
  const obsUnknown = (json as FredResponseRaw)?.observations;
  const arr = Array.isArray(obsUnknown) ? (obsUnknown as FredObservationRaw[]) : [];

  return arr
    .map<FredPoint>((o) => {
      const date = String(o?.date ?? "").slice(0, 10);
      const value = toNum(String(o?.value ?? "."));
      return { date, value };
    })
    .filter((p) => Number.isFinite(p.value));
}

/**
 * Fetch a FRED series and return cleaned points (date, numeric value).
 * Throws on 4xx (e.g., bad id) with a helpful error including response snippet.
 */
export async function fetchFredSeries(
  id: string,
  start: string,
  end: string,
  apiKey: string,
  opts?: Partial<FetchFredOptions>
): Promise<FredPoint[]> {
  const options: FetchFredOptions = {
    apiKey,
    start,
    end,
    revalidate: opts?.revalidate ?? 3600,
    retries: opts?.retries ?? 1,
    timeoutMs: opts?.timeoutMs ?? 10_000,
    params: opts?.params,
  };

  const url = buildFredUrl(id, options);
  const res = await fetchWithRetry(url, options);

  if (!res.ok) {
    // Try to surface FRED's error payload (often has error_code & error_message)
    let snippet = "";
    try {
      const text = await res.text();
      snippet = text.slice(0, 240);
    } catch {
      /* ignore */
    }
    throw new Error(`${id} ${res.status} ${snippet}`);
  }

  const jsonUnknown: unknown = await res.json();
  return parseFredResponse(jsonUnknown);
}
