import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function yahooV8DailyClose(symbol: string, ymd: string): Promise<number | null> {
  const base = new Date(ymd + "T00:00:00Z").getTime();
  const start = Math.floor((base - 7 * 86400_000) / 1000);
  const end   = Math.floor((base + 3 * 86400_000) / 1000);
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

async function yahooV7Spot(symbol: string): Promise<number | null> {
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

const inv = (x: number | null) => (x && x !== 0 ? 1 / x : null);

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "GBPUSD=X";
  const ymd = searchParams.get("ymd") ?? "2025-09-02";

  const v8Primary = await yahooV8DailyClose(symbol, ymd);

  let altMono: string | null = null;
  let v8AltMono: number | null = null;
  let v7AltMonoSpot: number | null = null;
  let invertedAlt: number | null = null;

  // If primary is XXXUSD=X and failed, try XXX=X and invert
  const m = symbol.match(/^([A-Z]{3})USD=X$/i);
  if (v8Primary == null && m) {
    const base = m[1].toUpperCase();
    altMono = `${base}=X`;
    v8AltMono = await yahooV8DailyClose(altMono, ymd);
    if (v8AltMono == null) v7AltMonoSpot = await yahooV7Spot(altMono);
    invertedAlt = inv(v8AltMono ?? v7AltMonoSpot);
  }

  const v7PrimarySpot = v8Primary == null ? await yahooV7Spot(symbol) : null;

  const chosen =
    v8Primary ??
    invertedAlt ??
    v7PrimarySpot ??
    null;

  return NextResponse.json(
    {
      input: { symbol, ymd },
      results: { v8Primary, altMono, v8AltMono, v7AltMonoSpot, invertedAlt, v7PrimarySpot },
      chosenUsdPerUnit: chosen,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
