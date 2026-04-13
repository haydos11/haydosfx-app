import { NextRequest, NextResponse } from "next/server";
import { syncMarketSentimentIntraday } from "@/lib/market-sentiment/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const vercelCronHeader = req.headers.get("x-vercel-cron");

  console.log("[cron auth debug]", {
    hasCronSecret: !!cronSecret,
    authHeaderPresent: !!authHeader,
    authHeaderPreview: authHeader ? `${authHeader.slice(0, 20)}...` : null,
    xVercelCron: vercelCronHeader,
    nodeEnv: process.env.NODE_ENV,
  });

  // Allow Vercel Cron requests
  if (vercelCronHeader === "1") {
    return true;
  }

  // Allow manual requests with Bearer token
  if (!cronSecret) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "2d";

    const startedAt = new Date().toISOString();

    console.log(
      `[cron] sync-market-sentiment-intraday started at ${startedAt} range=${range}`
    );

    const result = await syncMarketSentimentIntraday(range);

    const finishedAt = new Date().toISOString();

    console.log(
      `[cron] sync-market-sentiment-intraday finished at ${finishedAt} range=${range} insertedAssets=${result.insertedAssets} failedAssets=${result.failedAssets} priceRows=${result.priceRows} snapshotRows=${result.snapshotRows}`
    );

    return NextResponse.json({
      ok: true,
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