import { NextRequest, NextResponse } from "next/server";
import { runScheduledCotSync } from "@/lib/cot/pipeline/run-scheduled-cot-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  // Optional fallback for manual browser testing:
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  return !!process.env.CRON_SECRET && key === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const result = await runScheduledCotSync({
      force,
      source: "vercel-cron",
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
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