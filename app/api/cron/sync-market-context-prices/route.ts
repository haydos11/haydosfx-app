import { NextRequest, NextResponse } from "next/server";
import { syncMarketContextPrices } from "@/lib/cot/pipeline/sync-market-context-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const vercelCronHeader = req.headers.get("x-vercel-cron");
  const manualKey = req.nextUrl.searchParams.get("manualKey");

  console.log("[cron auth debug][market-context]", {
    hasCronSecret: !!cronSecret,
    authHeaderPresent: !!authHeader,
    authHeaderPreview: authHeader ? `${authHeader.slice(0, 20)}...` : null,
    xVercelCron: vercelCronHeader,
    manualKeyPresent: !!manualKey,
    nodeEnv: process.env.NODE_ENV,
  });

  if (vercelCronHeader === "1") {
    return true;
  }

  if (!cronSecret) {
    return false;
  }

  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  if (manualKey && manualKey === cronSecret) {
    return true;
  }

  return false;
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

    const startedAt = new Date().toISOString();

    console.log(
      `[cron] sync-market-context-prices started at ${startedAt}`
    );

    const result = await syncMarketContextPrices();

    const finishedAt = new Date().toISOString();

    console.log(
      `[cron] sync-market-context-prices finished at ${finishedAt} inserted=${result.inserted} cutoff=${result.cutoff}`
    );

    return NextResponse.json({
      ok: true,
      job: "sync-market-context-prices",
      startedAt,
      finishedAt,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected cron error";

    console.error("[cron] sync-market-context-prices failed", error);

    return NextResponse.json(
      {
        ok: false,
        job: "sync-market-context-prices",
        error: message,
      },
      { status: 500 }
    );
  }
}