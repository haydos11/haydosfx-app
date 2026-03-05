import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type V7Quote = {
  symbol: string;

  // Common fields Yahoo may return (varies by instrument)
  regularMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketPrice?: number | null;
  regularMarketPreviousClose?: number | null;

  // Sometimes there’s also these on some symbols:
  bid?: number | null;
  ask?: number | null;
};

type V7Resp = {
  quoteResponse?: {
    result?: V7Quote[];
  };
};

function pickPrice(q: V7Quote | undefined): number | null {
  if (!q) return null;

  const candidates = [
    q.regularMarketPrice,
    q.postMarketPrice,
    q.preMarketPrice,
    q.regularMarketPreviousClose,
    q.bid,
    q.ask,
  ];

  for (const p of candidates) {
    if (typeof p === "number" && Number.isFinite(p)) return p;
  }

  return null;
}

async function yahooV7Quote(symbol: string): Promise<V7Quote | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // Yahoo is flaky without a UA sometimes
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (!res.ok) return null;

  const raw: unknown = await res.json();
  const json = raw as V7Resp;
  const q = json.quoteResponse?.result?.[0];

  return q ?? null;
}

async function yahooV7Spot(symbol: string): Promise<number | null> {
  try {
    const q = await yahooV7Quote(symbol);
    return pickPrice(q ?? undefined);
  } catch {
    return null;
  }
}

async function yahooWithFallback(symbols: string[]): Promise<number | null> {
  for (const s of symbols) {
    const p = await yahooV7Spot(s);
    if (p != null) return p;
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  try {
    // Use fallbacks for the common “null offenders”
    const [vix, spx, us10y, dxy, gold, oil] = await Promise.all([
      yahooWithFallback(["^VIX"]),
      yahooWithFallback(["^GSPC"]),
      yahooWithFallback(["^TNX"]), // add "^FVX" here if you want a fallback: ["^TNX","^FVX"]
      yahooWithFallback(["DX-Y.NYB", "^DXY"]),
      yahooWithFallback(["GC=F"]),
      yahooWithFallback(["CL=F"]),
    ]);

    return NextResponse.json(
      { vix, spx, us10y, dxy, gold, oil },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Market API error:", err);
    return NextResponse.json({ error: "Market fetch failed" }, { status: 500 });
  }
}