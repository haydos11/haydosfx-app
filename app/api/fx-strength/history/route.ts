// app/api/fx-strength/history/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge"; // Vercel Edge-friendly

/** ---------- Types ---------- */
type Pair = { base: string; quote: string; y: string };
type StrengthRow = Record<string, number>;

type HistoryPayload = {
  updated: string;
  tf: number;         // window in trading days (1,5,22,66…)
  days: number;       // number of output dates
  dates: string[];    // YYYY-MM-DD
  ccys: string[];     // legend order
  scale: "minmax" | "rank" | "normcdf" | "z";
  smooth: number;     // 0..0.99 EMA alpha
  winsor: number;     // 0..0.2 (tails clipped per day before scaling)
  universe: "g8" | "broad";
  series: Record<string, (number | null)[]>;
};

const CACHE_TTL_SECONDS = 600;

/** ---------- Optional Vercel KV (typed, no any) ---------- */
type VercelKV = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, val: unknown, opts?: { ex?: number }) => Promise<unknown>;
};
type VercelKVModule = { kv?: VercelKV };

let kvReady: Promise<VercelKV | null> | null = null;
let kvRef: VercelKV | null = null;

async function ensureKV(): Promise<VercelKV | null> {
  if (kvRef) return kvRef;
  if (!kvReady) {
    kvReady = (async () => {
      try {
        const mod = (await import("@vercel/kv")) as unknown as VercelKVModule;
        kvRef = mod.kv ?? null;
      } catch {
        kvRef = null;
      }
      return kvRef;
    })();
  }
  return kvReady;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await ensureKV();
  if (!kv) return null;
  try {
    const v = await kv.get(key);
    return (v as T) ?? null;
  } catch {
    return null;
  }
}
async function kvSet<T>(key: string, val: T, ttlSec: number): Promise<void> {
  const kv = await ensureKV();
  if (!kv) return;
  try {
    await kv.set(key, val as unknown, { ex: ttlSec });
  } catch {
    // ignore
  }
}

/** ---------- In-memory fallback cache (per-edge isolate) ---------- */
const memoryCache: Record<string, { ts: number; payload: HistoryPayload }> = {};

/** ---------- Universes ---------- */
// Exact 28 G8 majors (MarketMilk core vibe)
const PAIRS_G8: Pair[] = [
  // USD legs
  { base: "EUR", quote: "USD", y: "EURUSD=X" },
  { base: "GBP", quote: "USD", y: "GBPUSD=X" },
  { base: "AUD", quote: "USD", y: "AUDUSD=X" },
  { base: "NZD", quote: "USD", y: "NZDUSD=X" },
  { base: "USD", quote: "JPY", y: "JPY=X" },
  { base: "USD", quote: "CHF", y: "CHF=X" },
  { base: "USD", quote: "CAD", y: "CAD=X" },

  // EUR crosses
  { base: "EUR", quote: "GBP", y: "EURGBP=X" },
  { base: "EUR", quote: "JPY", y: "EURJPY=X" },
  { base: "EUR", quote: "CHF", y: "EURCHF=X" },
  { base: "EUR", quote: "CAD", y: "EURCAD=X" },
  { base: "EUR", quote: "AUD", y: "EURAUD=X" },
  { base: "EUR", quote: "NZD", y: "EURNZD=X" },

  // GBP crosses
  { base: "GBP", quote: "JPY", y: "GBPJPY=X" },
  { base: "GBP", quote: "CHF", y: "GBPCHF=X" },
  { base: "GBP", quote: "CAD", y: "GBPCAD=X" },
  { base: "GBP", quote: "AUD", y: "GBPAUD=X" },
  { base: "GBP", quote: "NZD", y: "GBPNZD=X" },

  // AUD crosses
  { base: "AUD", quote: "JPY", y: "AUDJPY=X" },
  { base: "AUD", quote: "CHF", y: "AUDCHF=X" },
  { base: "AUD", quote: "CAD", y: "AUDCAD=X" },
  { base: "AUD", quote: "NZD", y: "AUDNZD=X" },

  // NZD crosses
  { base: "NZD", quote: "JPY", y: "NZDJPY=X" },
  { base: "NZD", quote: "CHF", y: "NZDCHF=X" },
  { base: "NZD", quote: "CAD", y: "NZDCAD=X" },

  // CAD / CHF / JPY last three
  { base: "CAD", quote: "JPY", y: "CADJPY=X" },
  { base: "CHF", quote: "JPY", y: "CHFJPY=X" },
];
const CCYS_G8 = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

// Broader (trimmed toward majors you had)
const PAIRS_BROAD: Pair[] = [
  { base: "EUR", quote: "USD", y: "EURUSD=X" },
  { base: "GBP", quote: "USD", y: "GBPUSD=X" },
  { base: "AUD", quote: "USD", y: "AUDUSD=X" },
  { base: "NZD", quote: "USD", y: "NZDUSD=X" },
  { base: "USD", quote: "JPY", y: "JPY=X" },
  { base: "USD", quote: "CHF", y: "CHF=X" },
  { base: "USD", quote: "CAD", y: "CAD=X" },

  { base: "EUR", quote: "GBP", y: "EURGBP=X" },
  { base: "EUR", quote: "JPY", y: "EURJPY=X" },
  { base: "EUR", quote: "CHF", y: "EURCHF=X" },
  { base: "EUR", quote: "AUD", y: "EURAUD=X" },
  { base: "EUR", quote: "NZD", y: "EURNZD=X" },
  { base: "EUR", quote: "CAD", y: "EURCAD=X" },

  { base: "GBP", quote: "JPY", y: "GBPJPY=X" },
  { base: "GBP", quote: "CHF", y: "GBPCHF=X" },
  { base: "GBP", quote: "AUD", y: "GBPAUD=X" },
  { base: "GBP", quote: "NZD", y: "GBPNZD=X" },
  { base: "GBP", quote: "CAD", y: "GBPCAD=X" },

  { base: "AUD", quote: "JPY", y: "AUDJPY=X" },
  { base: "NZD", quote: "JPY", y: "NZDJPY=X" },
  { base: "CAD", quote: "JPY", y: "CADJPY=X" },
  { base: "CHF", quote: "JPY", y: "CHFJPY=X" },

  { base: "AUD", quote: "CHF", y: "AUDCHF=X" },
  { base: "NZD", quote: "CHF", y: "NZDCHF=X" },
  { base: "CAD", quote: "CHF", y: "CADCHF=X" },
  { base: "AUD", quote: "NZD", y: "AUDNZD=X" },
  { base: "AUD", quote: "CAD", y: "AUDCAD=X" },
  { base: "NZD", quote: "CAD", y: "NZDCAD=X" },
];
const CCYS_BROAD = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

/** ---------- Yahoo minimal types ---------- */
type YQuote = { close?: (number | null)[] };
type YResult = { timestamp?: number[]; indicators?: { quote?: YQuote[] } };
type YResp = { chart?: { result?: YResult[] } };

/** ---------- Math helpers ---------- */
function zstats(values: number[]) {
  const mu = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const sd =
    Math.sqrt(
      values.reduce((a, b) => a + (b - mu) * (b - mu), 0) /
        Math.max(values.length, 1)
    ) || 1;
  return { mu, sd };
}
function minmaxScaleRow(row: StrengthRow) {
  const vals = Object.values(row);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const out: StrengthRow = {};
  for (const k of Object.keys(row)) out[k] = ((row[k] - lo) / span) * 10;
  return out;
}
function zScaleRow(row: StrengthRow) {
  const { mu, sd } = zstats(Object.values(row));
  const out: StrengthRow = {};
  for (const k of Object.keys(row)) out[k] = (row[k] - mu) / sd;
  return out;
}
function rankScaleRow(row: StrengthRow) {
  const entries = Object.entries(row).sort((a, b) => a[1] - b[1]);
  const n = Math.max(entries.length - 1, 1);
  const out: StrengthRow = {};
  entries.forEach(([k], i) => (out[k] = (i / n) * 10));
  return out;
}
function ema(prev: number | null, value: number | null, alpha: number): number | null {
  if (value == null) return prev;
  if (prev == null) return value;
  return alpha * value + (1 - alpha) * prev;
}

/** ----- Pretty scaling (Φ(z)) + Winsorization ----- */
function erf(x: number) {
  // Abramowitz–Stegun approximation
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429;
  const p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-ax*ax);
  return sign * y;
}
function normCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}
function winsorRow(row: Record<string, number>, p: number) {
  if (!(p > 0 && p < 0.5)) return row;
  const vals = Object.values(row).filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if (vals.length < 3) return row;
  const lo = quantile(vals, p);
  const hi = quantile(vals, 1 - p);
  const out: Record<string, number> = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : v;
  }
  return out;
}
function normcdfScaleRow(row: Record<string, number>) {
  const { mu, sd } = zstats(Object.values(row));
  const out: Record<string, number> = {};
  for (const k of Object.keys(row)) {
    const z = sd ? (row[k] - mu) / sd : 0;
    out[k] = 10 * normCdf(z); // smooth 0..10
  }
  return out;
}

/** ---------- Data fetch ---------- */
// Fetch daily closes for each pair; returns sym -> { dateISO -> close }
async function fetchDailyCloses(pairs: Pair[], range = "1y") {
  const out: Record<string, Record<string, number>> = {};
  const chunk = <T,>(arr: T[], n = 6) =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
      arr.slice(i * n, (i + 1) * n)
    );

  for (const group of chunk(pairs, 6)) {
    await Promise.all(
      group.map(async (p) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            p.y
          )}?range=${range}&interval=1d`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Accept: "application/json,text/plain,*/*",
              Referer: "https://finance.yahoo.com/",
            },
            cache: "no-store",
          });
          if (!res.ok) return;
          const j = (await res.json()) as YResp;
          const r = j?.chart?.result?.[0];
          const close = r?.indicators?.quote?.[0]?.close;
          const ts = r?.timestamp;
          if (!close || !ts || close.length === 0) return;

          const m: Record<string, number> = {};
          for (let i = 0; i < close.length; i++) {
            const c = close[i];
            const t = ts[i];
            if (typeof c !== "number" || !Number.isFinite(c) || typeof t !== "number") continue;
            const dateISO = new Date(t * 1000).toISOString().slice(0, 10);
            m[dateISO] = c;
          }
          out[p.y] = m;
        } catch {
          // ignore single pair failure
        }
      })
    );
  }
  return out;
}

/** ---------- Strength calc (MarketMilk-style) ---------- */
function computeStrengthWindowed(
  pairs: Pair[],
  closes: Record<string, Record<string, number>>,
  datesAsc: string[],
  tf: number
) {
  const strengthsByDate: Record<string, StrengthRow> = {};

  const indexed: Record<string, { dates: string[]; map: Record<string, number> }> = {};
  for (const p of pairs) {
    const map = closes[p.y];
    if (!map) continue;
    const ds = Object.keys(map).sort();
    indexed[p.y] = { dates: ds, map };
  }

  for (const d of datesAsc) {
    const bucket: Record<string, number[]> = {};
    for (const p of pairs) {
      const idx = indexed[p.y];
      if (!idx) continue;

      const pos = idx.dates.indexOf(d);
      if (pos === -1) continue;
      const prevPos = pos - tf;
      if (prevPos < 0) continue;

      const cNow = idx.map[idx.dates[pos]];
      const cPrev = idx.map[idx.dates[prevPos]];
      if (!Number.isFinite(cNow) || !Number.isFinite(cPrev)) continue;

      const chg = cPrev === 0 ? 0 : cNow / cPrev - 1; // cumulative % over window

      (bucket[p.base] ||= []).push(chg);
      (bucket[p.quote] ||= []).push(-chg);
    }

    const row: StrengthRow = {};
    for (const k of Object.keys(bucket)) {
      const arr = bucket[k];
      if (arr.length === 0) continue;
      row[k] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    strengthsByDate[d] = row;
  }

  return strengthsByDate;
}

/** ---------- Handler ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Params
    const tf = Math.max(1, Math.min(90, Number(searchParams.get("tf") || "22"))); // 1,5,22,66 typical
    const days = Math.max(5, Math.min(180, Number(searchParams.get("days") || "60")));
    const universe = (searchParams.get("universe") || "g8") as "g8" | "broad";
    const scale = (searchParams.get("scale") || "normcdf") as "minmax" | "rank" | "normcdf" | "z";
    const smooth = Math.max(0, Math.min(0.99, Number(searchParams.get("smooth") || "0"))); // 0..0.99
    const winsor = Math.max(0, Math.min(0.2, Number(searchParams.get("winsor") || "0"))); // 0..0.2

    const PAIRS = universe === "g8" ? PAIRS_G8 : PAIRS_BROAD;
    const CCYS = universe === "g8" ? CCYS_G8 : CCYS_BROAD;

    const cacheKey = `mmhist:${universe}:${tf}:${days}:${scale}:${smooth}:${winsor}`;

    // KV cache
    const kvCached = await kvGet<HistoryPayload>(cacheKey);
    if (kvCached) {
      return new NextResponse(JSON.stringify(kvCached), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=600, stale-while-revalidate=60",
        },
      });
    }

    // Memory cache
    const mem = memoryCache[cacheKey];
    if (mem && Date.now() - mem.ts < CACHE_TTL_SECONDS * 1000) {
      return new NextResponse(JSON.stringify(mem.payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=600, stale-while-revalidate=60",
        },
      });
    }

    // Data
    const closesBySym = await fetchDailyCloses(PAIRS, "1y");
    const allDates = Array.from(
      new Set(Object.values(closesBySym).flatMap((m) => Object.keys(m)))
    ).sort();

    const need = days + tf;
    const effective = allDates.slice(-need);
    if (effective.length < tf + 1) {
      return NextResponse.json(
        { error: "Insufficient data to compute requested timeframe." },
        { status: 400 }
      );
    }

    // Raw strength rows
    const rawRows = computeStrengthWindowed(PAIRS, closesBySym, effective, tf);
    const dates = effective.slice(-days);

    // Scale each row (with optional winsorization)
    const scaledRows: Record<string, StrengthRow> = {};
    for (const d of dates) {
      const baseRow: StrengthRow = {};
      for (const c of CCYS) baseRow[c] = Number.NaN;

      let row = { ...baseRow, ...(rawRows[d] || {}) };
      if (winsor > 0) row = winsorRow(row, winsor);

      let scaled: StrengthRow;
      switch (scale) {
        case "z":
          scaled = zScaleRow(row);          // raw z (not 0..10)
          break;
        case "rank":
          scaled = rankScaleRow(row);       // 0..10 by rank
          break;
        case "normcdf":
          scaled = normcdfScaleRow(row);    // smooth 0..10 via Φ(z)
          break;
        case "minmax":
        default:
          scaled = minmaxScaleRow(row);     // 0..10 linear
      }
      scaledRows[d] = scaled;
    }

    // Build series with optional EMA smoothing
    const series: Record<string, (number | null)[]> = {};
    const prev: Record<string, number | null> = {};
    for (const c of CCYS) {
      series[c] = [];
      prev[c] = null;
    }
    for (const d of dates) {
      const row = scaledRows[d];
      for (const c of CCYS) {
        const v = row[c];
        const val = Number.isFinite(v) ? (v as number) : null;
        const sm = smooth > 0 ? ema(prev[c], val, smooth) : val;
        series[c].push(sm);
        prev[c] = sm;
      }
    }

    const payload: HistoryPayload = {
      updated: new Date().toISOString(),
      tf,
      days,
      dates,
      ccys: CCYS,
      series,
      scale,
      smooth,
      winsor,
      universe,
    };

    // Save caches
    memoryCache[cacheKey] = { ts: Date.now(), payload };
    await kvSet(cacheKey, payload, CACHE_TTL_SECONDS);

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
