import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** ---------- Config & Types ---------- */
type Pair = { base: string; quote: string; y: string };
type Strength = Record<string, number>;

const TTL_SECONDS = 600; // cache 10 min
const memoryCache: Record<string, { ts: number; payload: any }> = {};

const PAIRS: Pair[] = [
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
  { base: "EUR", quote: "SEK", y: "EURSEK=X" },
  { base: "EUR", quote: "NOK", y: "EURNOK=X" },

  { base: "GBP", quote: "JPY", y: "GBPJPY=X" },
  { base: "GBP", quote: "CHF", y: "GBPCHF=X" },
  { base: "GBP", quote: "AUD", y: "GBPAUD=X" },
  { base: "GBP", quote: "NZD", y: "GBPNZD=X" },
  { base: "GBP", quote: "CAD", y: "GBPCAD=X" },

  { base: "AUD", quote: "JPY", y: "AUDJPY=X" },
  { base: "NZD", quote: "JPY", y: "NZDJPY=X" },
  { base: "CAD", quote: "JPY", y: "CADJPY=X" },
  { base: "CHF", quote: "JPY", y: "CHFJPY=X" },
  { base: "SEK", quote: "JPY", y: "SEKJPY=X" },
  { base: "NOK", quote: "JPY", y: "NOKJPY=X" },

  { base: "AUD", quote: "CHF", y: "AUDCHF=X" },
  { base: "NZD", quote: "CHF", y: "NZDCHF=X" },
  { base: "CAD", quote: "CHF", y: "CADCHF=X" },
  { base: "AUD", quote: "NZD", y: "AUDNZD=X" },
  { base: "AUD", quote: "CAD", y: "AUDCAD=X" },
  { base: "NZD", quote: "CAD", y: "NZDCAD=X" },

  { base: "USD", quote: "CNH", y: "CNH=X" },
  { base: "USD", quote: "HKD", y: "HKD=X" },
  { base: "USD", quote: "SGD", y: "SGD=X" },
  { base: "USD", quote: "MXN", y: "MXN=X" },
  { base: "USD", quote: "ZAR", y: "ZAR=X" },
];

// Which currencies to include in the history output (order is legend order)
const CCYS = ["AUD","CAD","CHF","EUR","GBP","JPY","NZD","USD","SEK","NOK","SGD","HKD","CNH","MXN","ZAR"];

/** ---------- Math ---------- */
function zscore(values: number[]) {
  const mu = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const sd =
    Math.sqrt(values.reduce((a, b) => a + (b - mu) * (b - mu), 0) / Math.max(values.length, 1)) || 1;
  return { mu, sd };
}

function computeStrengthFromPairs(pairReturns: Record<string, number>): Strength {
  const bucket: Record<string, number[]> = {};
  for (const p of PAIRS) {
    const r = pairReturns[p.y];
    if (!Number.isFinite(r)) continue;
    (bucket[p.base] ||= []).push(r);   // base +r
    (bucket[p.quote] ||= []).push(-r); // quote −r
  }
  const strengths: Strength = {};
  for (const c of Object.keys(bucket)) {
    const arr = bucket[c];
    strengths[c] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  const vals = Object.values(strengths);
  const { mu, sd } = zscore(vals);
  for (const k of Object.keys(strengths)) strengths[k] = (strengths[k] - mu) / sd;
  return strengths;
}

/** ---------- Data fetch ---------- */
// fetch daily closes for each pair; build map: symbol -> {dateISO -> logReturn}
async function fetchDailyPairReturns(range = "6mo") {
  const out: Record<string, Record<string, number>> = {}; // sym -> date -> log ret
  const chunk = <T,>(arr: T[], n = 6) =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

  for (const group of chunk(PAIRS, 6)) {
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
          const j: any = await res.json();
          const r = j?.chart?.result?.[0];
          const close = r?.indicators?.quote?.[0]?.close as number[] | undefined;
          const ts = r?.timestamp as number[] | undefined;
          if (!close || !ts || close.length < 2) return;

          const m: Record<string, number> = {};
          for (let i = 1; i < close.length; i++) {
            const c = close[i], pclose = close[i - 1];
            if (!Number.isFinite(c) || !Number.isFinite(pclose)) continue;
            const dateISO = new Date(ts[i] * 1000).toISOString().slice(0, 10); // attribute return to this day’s close
            m[dateISO] = Math.log(c / pclose);
          }
          out[p.y] = m;
        } catch {}
      })
    );
  }
  return out;
}

/** ---------- Handler ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.max(5, Math.min(180, Number(searchParams.get("days") || "30"))); // 30 or 60 commonly

    const cacheKey = `hist:${days}`;
    const cached = memoryCache[cacheKey];
    if (cached && Date.now() - cached.ts < TTL_SECONDS * 1000) {
      return NextResponse.json(cached.payload);
    }

    // 6 months covers 60 days easily
    const pairReturnsByDate = await fetchDailyPairReturns("6mo");

    // Build the union of dates, sort ascending
    const allDates = Array.from(
      new Set(
        Object.values(pairReturnsByDate).flatMap((m) => Object.keys(m))
      )
    ).sort(); // YYYY-MM-DD sorts lexicographically

    // Take the last N dates
    const slice = allDates.slice(-days);

    // For each date, compute strengths (z-scored) from the pair returns available that day
    const dates: string[] = [];
    const series: Record<string, number[]> = {};
    for (const c of CCYS) series[c] = [];

    for (const d of slice) {
      const pairRets: Record<string, number> = {};
      for (const p of PAIRS) {
        const r = pairReturnsByDate[p.y]?.[d];
        if (Number.isFinite(r)) pairRets[p.y] = r!;
      }
      const strengths = computeStrengthFromPairs(pairRets);
      dates.push(d);
      for (const c of CCYS) series[c].push(
        Number.isFinite(strengths[c]) ? strengths[c] : null as any
      );
    }

    const payload = {
      updated: new Date().toISOString(),
      days,
      dates,          // e.g. ["2025-08-05", ...]
      ccys: CCYS,     // order for legend
      series,         // { USD: [z,...], EUR: [z,...], ... }
    };

    memoryCache[cacheKey] = { ts: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to build FX strength history" },
      { status: 502 }
    );
  }
}
