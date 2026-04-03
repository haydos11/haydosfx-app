import { NextResponse } from "next/server";
import { syncCotReports } from "@/lib/cot/pipeline/sync";
import { syncCotMarketPrices } from "@/lib/cot/pipeline/sync-market-prices";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("key");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== COT CRON START ===");

    // 1. COT reports
    const cotResult = await syncCotReports("cron");
    console.log("COT sync done");

    // 2. Market + FX prices (YOUR FULL ENGINE)
    const priceResult = await syncCotMarketPrices();
    console.log("Price sync done", priceResult);

    return NextResponse.json({
      ok: true,
      cot: cotResult,
      prices: priceResult,
    });
  } catch (err) {
    console.error("Cron failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}