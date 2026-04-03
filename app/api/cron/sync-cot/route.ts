import { NextRequest, NextResponse } from "next/server";
import { syncCotReports } from "@/lib/cot/pipeline/sync";
import { syncCotMarketPrices } from "@/lib/cot/pipeline/sync-market-prices";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  return !!process.env.CRON_SECRET && key === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log("=== CRON START ===");

    // 1. Sync COT reports (already efficient)
    const cotResult = await syncCotReports("cron");
    console.log("COT sync complete");

    // 2. Sync ONLY recent prices (FAST)
    const priceResult = await syncCotMarketPrices("recent");
    console.log("Price sync complete", priceResult);

    return NextResponse.json({
      ok: true,
      cot: cotResult,
      prices: priceResult,
    });
  } catch (error) {
    console.error("[cron/sync-cot] fatal:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}