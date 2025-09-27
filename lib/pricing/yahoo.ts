// lib/pricing/yahoo.ts
type YHistResp = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: unknown;
  };
};

type V7Quote = { symbol: string; regularMarketPrice?: number | null };
type V7Resp = { quoteResponse?: { result?: V7Quote[] } };

/** Safe inverse for FX pairs quoted as units-per-USD. */
export const inv = (x: number | null) => (x && x !== 0 ? 1 / x : null);

/* ---------------- In-memory TTL caches (per server/edge instance) ---------------- */
type CacheEntry<T> = { value: T; expiresAt: number };
const g = globalThis as unknown as {
  __y_spot?: Map<string, CacheEntry<number | null>>;
  __y_daily?: Map<string, CacheEntry<number | null>>;
};

if (!g.__y_spot) g.__y_spot = new Map();
if (!g.__y_daily) g.__y_daily = new Map();

const now = () => Date.now();
function cacheGet<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = m.get(key);
  if (!e) return null;
  if (e.expiresAt <= now()) { m.delete(key); return null; }
  return e.value;
}
function cacheSet<T>(m: Map<string, CacheEntry<T>>, key: string, value: T, ttlSec: number) {
  m.set(key, { value, expiresAt: now() + ttlSec * 1000 });
}

/** Fallback: lightweight last price via Yahoo v7 quote endpoint. */
async function yahooSpot(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const json = raw as V7Resp;
    const p = json.quoteResponse?.result?.[0]?.regularMarketPrice;
    return typeof p === "number" && Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

/** Short-TTL cache for spot (fast-moving). Default TTL: 60s. */
async function yahooSpotCached(symbol: string, ttlSec = 60): Promise<number | null> {
  const key = symbol.toUpperCase();
  const hit = cacheGet(g.__y_spot!, key);
  if (hit !== null) return hit; // may be null (negative cache)
  const px = await yahooSpot(symbol);
  cacheSet(g.__y_spot!, key, px, ttlSec);
  return px;
}

/** Core: get the closest non-null daily close around ymd for a given ticker. */
async function yahooDailyClose(symbol: string, ymd: string): Promise<number | null> {
  const base = new Date(`${ymd}T00:00:00Z`).getTime();
  // widen a bit – FX often has gaps on holidays/weekends
  const start = Math.floor((base - 7 * 86_400_000) / 1000);
  const end   = Math.floor((base + 3 * 86_400_000) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const raw: unknown = await res.json();
    const data = raw as YHistResp;

    const r = data.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const closes = r?.indicators?.quote?.[0]?.close ?? [];
    if (!ts.length || !closes.length) return null;

    const target = Math.floor(base / 1000);
    let bestIdx = -1;
    let bestDiff = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(Number(c))) continue;
      const diff = Math.abs(ts[i] - target);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    return bestIdx >= 0 ? Number(closes[bestIdx]) : null;
  } catch {
    return null;
  }
}

/** Long-TTL cache for daily close (near-immutable). Default TTL: 30 days. */
async function yahooDailyCloseCached(symbol: string, ymd: string, ttlSec = 30 * 24 * 3600): Promise<number | null> {
  const key = `${symbol.toUpperCase()}:${ymd}`;
  const hit = cacheGet(g.__y_daily!, key);
  if (hit !== null) return hit; // may be null (negative cache)
  const px = await yahooDailyClose(symbol, ymd);
  cacheSet(g.__y_daily!, key, px, ttlSec);
  return px;
}

/**
 * Fetch a historical daily close near `YYYY-MM-DD` (UTC).
 * Extra resilience for FX:
 * - If the symbol is a pair `XXXUSD=X` and has no candles, try `XXX=X` and invert.
 * - As a last resort, use v7 spot for either symbol.
 */
export async function yahooCloseOn(symbol: string, ymd: string): Promise<number | null> {
  // 1) Try the requested symbol first (cached)
  const primary = await yahooDailyCloseCached(symbol, ymd);
  if (primary != null) return primary;

  // 2) If it looks like a XXXUSD=X pair, try XXX=X (USD/XXX) and invert
  const m = symbol.match(/^([A-Z]{3})USD=X$/i);
  if (m) {
    const base = m[1].toUpperCase();
    const alt = `${base}=X`; // e.g., GBP=X (USD/GBP)
    const altClose = await yahooDailyCloseCached(alt, ymd);
    const altSpot  = altClose ?? (await yahooSpotCached(alt));
    const invAlt   = inv(altSpot);
    if (invAlt != null) return invAlt;
  }

  // 3) Last resort: v7 spot on the original symbol (cached)
  return yahooSpotCached(symbol);
}
