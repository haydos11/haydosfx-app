// app/api/ohlc/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Candle = { t: number; o: number | null; h: number | null; l: number | null; c: number | null; v: number | null };
type Series = { symbol: string; ok: boolean; source: "yahoo" | "fallback"; meta?: any; candles?: Candle[]; error?: string };

const DEFAULT_RANGE = "6mo";
const DEFAULT_INTERVAL = "1d";

// Map friendly codes -> Yahoo Finance symbols
function expandSymbol(s: string): string[] {
  const x = s.trim().toUpperCase();
  if (!x) return [];
  if (x === "CNY") return ["USDCNY=X"]; // USD/CNY
  if (x === "CNH") return ["USDCNH=X"]; // USD/CNH
  return [x]; // already a Yahoo symbol like USDCNH=X or CNYUSD=X etc.
}

async function fetchYahooSeries(symbol: string, range: string, interval: string): Promise<Series> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=capitalGain%2Cdiv%2Csplit`;
  const res = await fetch(url, {
    // cache hint for Vercel CDN; tweak as you like
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    return { symbol, ok: false, source: "yahoo", error: `HTTP ${res.status}` };
  }

  const json = await res.json();
  const chart = json?.chart;
  if (chart?.error) {
    return { symbol, ok: false, source: "yahoo", error: chart.error?.description ?? "Unknown Yahoo error" };
  }

  const result = chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0] ?? {};

  const opens: (number | null)[] = quote.open ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows:  (number | null)[] = quote.low  ?? [];
  const closes:(number | null)[] = quote.close?? [];
  const vols:  (number | null)[] = quote.volume?? [];

  // Align lengths and build candles
  const len = Math.min(timestamps.length, opens.length, highs.length, lows.length, closes.length);
  const candles: Candle[] = [];
  for (let i = 0; i < len; i++) {
    candles.push({
      t: (timestamps[i] ?? 0) * 1000, // ms
      o: opens[i] ?? null,
      h: highs[i] ?? null,
      l: lows[i]  ?? null,
      c: closes[i]?? null,
      v: vols[i] ?? null,
    });
  }

  return {
    symbol,
    ok: true,
    source: "yahoo",
    meta: {
      range,
      interval,
      currency: result?.meta?.currency,
      exchangeName: result?.meta?.exchangeName,
      instrumentType: result?.meta?.instrumentType,
      gmtoffset: result?.meta?.gmtoffset,
    },
    candles,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbols") ?? "CNH,CNY";
  const range = searchParams.get("range") ?? DEFAULT_RANGE;
  const interval = searchParams.get("interval") ?? DEFAULT_INTERVAL;

  const requested = raw.split(",").map(s => s.trim()).filter(Boolean);
  const yahooSymbols = requested.flatMap(expandSymbol);

  const results = await Promise.all(yahooSymbols.map(sym => fetchYahooSeries(sym, range, interval)));

  // Cache headers: edge cache 5m, allow stale-while-revalidate 1h
  const res = NextResponse.json({ range, interval, count: results.length, results }, { status: 200 });
  res.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  return res;
}
