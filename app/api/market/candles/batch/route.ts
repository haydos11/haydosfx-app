// app/api/market/candles/batch/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CandleApiRow = {
  symbol: string;
  timeframe: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SingleCandleApiResponse = {
  ok: boolean;
  candles?: CandleApiRow[];
  error?: string;
};

type BatchCandleApiResponse = {
  ok: boolean;
  candlesByPair?: Record<string, CandleApiRow[]>;
  error?: string;
  cached?: boolean;
};

const DEFAULT_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY",
  "EURGBP",
  "EURAUD",
  "EURNZD",
  "EURCAD",
  "EURCHF",
  "EURJPY",
  "GBPAUD",
  "GBPNZD",
  "GBPCAD",
  "GBPCHF",
  "GBPJPY",
  "AUDNZD",
  "AUDCAD",
  "AUDCHF",
  "AUDJPY",
  "NZDCAD",
  "NZDCHF",
  "NZDJPY",
  "CADCHF",
  "CADJPY",
  "CHFJPY",
] as const;

type SourceTf = "M5" | "H1";

type CacheEntry = {
  expiresAt: number;
  payload: BatchCandleApiResponse;
};

const memoryCache = new Map<string, CacheEntry>();

function getTtlMs(timeframe: SourceTf) {
  return timeframe === "H1" ? 120_000 : 20_000;
}

function cleanupCache(now: number) {
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) memoryCache.delete(key);
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl;

  const timeframe = (searchParams.get("timeframe") || "H1").toUpperCase() as SourceTf;
  const limit = Number(searchParams.get("limit") || (timeframe === "M5" ? 600 : 1200));
  const symbolsParam = searchParams.get("symbols");

  if (timeframe !== "M5" && timeframe !== "H1") {
    return NextResponse.json(
      { ok: false, error: `Unsupported timeframe: ${timeframe}` },
      { status: 400 }
    );
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json(
      { ok: false, error: `Invalid limit: ${searchParams.get("limit")}` },
      { status: 400 }
    );
  }

  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [...DEFAULT_PAIRS];

  if (!symbols.length) {
    return NextResponse.json({ ok: false, error: "No symbols supplied" }, { status: 400 });
  }

  const cacheKey = `${timeframe}:${limit}:${symbols.join(",")}`;
  const now = Date.now();
  cleanupCache(now);

  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ ...cached.payload, cached: true });
  }

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const url = new URL("/api/market/candles", origin);
        url.searchParams.set("symbol", symbol);
        url.searchParams.set("timeframe", timeframe);
        url.searchParams.set("limit", String(limit));

        const res = await fetch(url.toString(), { cache: "no-store" });
        const json = (await res.json()) as SingleCandleApiResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Failed to load ${symbol} ${timeframe}`);
        }

        return [symbol, Array.isArray(json.candles) ? json.candles : []] as const;
      })
    );

    const payload: BatchCandleApiResponse = {
      ok: true,
      candlesByPair: Object.fromEntries(results),
      cached: false,
    };

    memoryCache.set(cacheKey, {
      expiresAt: now + getTtlMs(timeframe),
      payload,
    });

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Batch candle fetch failed",
      },
      { status: 500 }
    );
  }
}