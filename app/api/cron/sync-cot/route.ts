import { NextRequest, NextResponse } from "next/server";
import { syncCotReports } from "@/lib/cot/pipeline/sync";
import { syncCotMarketPrices } from "@/lib/cot/pipeline/sync-market-prices";
import { rebuildRecentServing } from "@/lib/cot/pipeline/rebuild-recent-serving";

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

    const cotResult = await syncCotReports("cron");
    console.log("[cron] COT sync complete", cotResult);

    const priceResult = await syncCotMarketPrices("recent");
    console.log("[cron] Price sync complete", priceResult);

    const servingResult = await rebuildRecentServing(35);
    console.log("[cron] Serving rebuild complete", servingResult);

    return NextResponse.json({
      ok: true,
      cot: cotResult,
      prices: priceResult,
      serving: servingResult,
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