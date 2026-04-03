import { NextResponse } from "next/server";
import { syncCotReports } from "@/lib/cot/pipeline/sync";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("key");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting COT sync...");

    // 1. Sync reports
    const cotResult = await syncCotReports("cron");
    console.log("COT sync done:", cotResult);

    // 2. Sync prices
    console.log("Starting price sync...");
    await execAsync("node scripts/sync-cot-market-prices.ts");
    console.log("Price sync done");

    return NextResponse.json({
      ok: true,
      cot: cotResult,
    });
  } catch (err) {
    console.error("Cron failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}