// lib/pricing/yahoo.ts
type YChartResult = {
  timestamp?: number[];
  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  meta?: { regularMarketPrice?: number | null };
};

type YHistResp = {
  chart?: {
    result?: YChartResult[];
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
  __y_intra?: Map<string, CacheEntry<number | null>>; // NEW: intraday last
};

if (!g.__y_spot) g.__y_spot = new Map();
if (!g.__y_daily) g.__y_daily = new Map();
if (!g.__y_intra) g.__y_intra = new Map();

const now = () => Date.now();
function cacheGet<T>(m: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = m.get(key);
  if (!e) return null;
  if (e.expiresAt <= now()) {
    m.delete(key);
    return null;
  }
  return e.value;
}
function cacheSet<T>(m: Map<string, CacheEntry<T>>, key: string, value: T, ttlSec: number) {
  m.set(key, { value, expiresAt: now() + ttlSec * 1000 });
}

/* ---------------- Small helpers ---------------- */
const isoDateUTC = (d: Date) => d.toISOString().slice(0, 10);
const todayUTC = () => isoDateUTC(new Date());
const isTodayUTC = (ymd: string) => ymd === todayUTC();

function lastNonNull(arr?: Array<number | null | undefined>): number | null {
  if (!arr || !arr.length) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/* ---------------- Yahoo v7 quote (fallback spot) ---------------- */
async function yahooSpot(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const json = raw as V7Resp;
    const p = json.quoteResponse?.result?.[0]?.regularMarketPrice;
    return typeof p === "number" && Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}
async function yahooSpotCached(symbol: string, ttlSec = 60): Promise<number | null> {
  const key = symbol.toUpperCase();
  const hit = cacheGet(g.__y_spot!, key);
  if (hit !== null) return hit; // may be null (negative cache)
  const px = await yahooSpot(symbol);
  cacheSet(g.__y_spot!, key, px, ttlSec);
  return px;
}

/* ---------------- Yahoo v8 chart: intraday last (range=1d) ---------------- */
async function yahooIntradayLast(symbol: string, interval = "5m"): Promise<number | null> {
  // Using chart API so we can get real intraday without v7 quote quirks.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1d&interval=${interval}&includePrePost=true&corsDomain=finance.yahoo.com`;
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const data = raw as YHistResp;

    const r: YChartResult | undefined = data.chart?.result?.[0];
    if (!r) return null;

    const close = r.indicators?.quote?.[0]?.close ?? [];
    const latest = lastNonNull(close);
    if (typeof latest === "number" && Number.isFinite(latest)) return latest;

    // Fallback to meta price in case the series is sparse (can happen around session edges)
    const meta = r.meta?.regularMarketPrice ?? null;
    return typeof meta === "number" && Number.isFinite(meta) ? meta : null;
  } catch {
    return null;
  }
}

async function yahooIntradayLastCached(symbol: string, ttlSec = 30, interval = "5m"): Promise<number | null> {
  const key = `${symbol.toUpperCase()}:i:${interval}`;
  const hit = cacheGet(g.__y_intra!, key);
  if (hit !== null) return hit; // may be null (negative cache)
  const px = await yahooIntradayLast(symbol, interval);
  cacheSet(g.__y_intra!, key, px, ttlSec);
  return px;
}

/* ---------------- Yahoo v8 chart: daily close near a UTC date ---------------- */
async function yahooDailyClose(symbol: string, ymd: string): Promise<number | null> {
  const base = new Date(`${ymd}T00:00:00Z`).getTime();
  // widen a bit – FX often has gaps on holidays/weekends
  const start = Math.floor((base - 7 * 86_400_000) / 1000);
  const end = Math.floor((base + 3 * 86_400_000) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?period1=${start}&period2=${end}&interval=1d`;
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
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
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx >= 0 ? Number(closes[bestIdx]) : null;
  } catch {
    return null;
  }
}
async function yahooDailyCloseCached(symbol: string, ymd: string, ttlSec = 30 * 24 * 3600): Promise<number | null> {
  const key = `${symbol.toUpperCase()}:${ymd}`;
  const hit = cacheGet(g.__y_daily!, key);
  if (hit !== null) return hit; // may be null (negative cache)
  const px = await yahooDailyClose(symbol, ymd);
  cacheSet(g.__y_daily!, key, px, ttlSec);
  return px;
}

/* ---------------- Public API: daily close, with intraday for "today" ---------------- */
/**
 * Fetch a historical daily close near `YYYY-MM-DD` (UTC).
 * Extra resilience for FX:
 * - If `ymd` is **today (UTC)**, prefer an **intraday last** (chart 1d/5m) so values move during the day.
 * - If the symbol is `XXXUSD=X` and has no data, try `XXX=X` and invert.
 * - As a final fallback, use v7 spot on the requested (or alt) symbol.
 */
export async function yahooCloseOn(symbol: string, ymd: string): Promise<number | null> {
  const wantToday = isTodayUTC(ymd);

  // 1) Try the requested symbol
  if (wantToday) {
    const intraday = await yahooIntradayLastCached(symbol); // ~30s TTL
    if (intraday != null) return intraday;
  }
  const primaryDaily = await yahooDailyCloseCached(symbol, ymd);
  if (primaryDaily != null) return primaryDaily;

  // 2) If it looks like XXXUSD=X, try XXX=X (i.e., USD/XXX) and invert
  const m = symbol.match(/^([A-Z]{3})USD=X$/i);
  if (m) {
    const base = m[1].toUpperCase();
    const alt = `${base}=X`; // e.g., GBP=X (USD/GBP)

    if (wantToday) {
      const altIntra = await yahooIntradayLastCached(alt);
      const invAltIntra = inv(altIntra);
      if (invAltIntra != null) return invAltIntra;
    }

    const altClose = await yahooDailyCloseCached(alt, ymd);
    const invAltDaily = inv(altClose);
    if (invAltDaily != null) return invAltDaily;

    const altSpot = await yahooSpotCached(alt);
    const invAltSpot = inv(altSpot);
    if (invAltSpot != null) return invAltSpot;
  }

  // 3) Last resort: v7 spot on the original
  return yahooSpotCached(symbol);
}
