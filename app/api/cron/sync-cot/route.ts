import { NextResponse } from "next/server";
import { syncCotReports } from "@/lib/cot/pipeline/sync";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("key");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting COT sync...");

    // ✅ Only run working pipeline
    const cotResult = await syncCotReports("cron");

    console.log("COT sync done:", cotResult);

    return NextResponse.json({
      ok: true,
      cot: cotResult,
    });
  } catch (err) {
    console.error("Cron failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}