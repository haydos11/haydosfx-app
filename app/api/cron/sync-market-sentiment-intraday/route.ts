import { NextRequest, NextResponse } from "next/server";
import { syncMarketSentimentIntraday } from "@/lib/market-sentiment/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "2d";

    const startedAt = new Date().toISOString();
    console.log(`[cron] sync-market-sentiment-intraday started at ${startedAt} range=${range}`);

    const result = await syncMarketSentimentIntraday(range);

    const finishedAt = new Date().toISOString();
    console.log(`[cron] sync-market-sentiment-intraday finished at ${finishedAt}`);

    return NextResponse.json({
      job: "sync-market-sentiment-intraday",
      startedAt,
      finishedAt,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected cron error";

    console.error("[cron] sync-market-sentiment-intraday failed", error);

    return NextResponse.json(
      {
        ok: false,
        job: "sync-market-sentiment-intraday",
        error: message,
      },
      { status: 500 }
    );
  }
}