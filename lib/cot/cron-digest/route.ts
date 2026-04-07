import { NextRequest, NextResponse } from "next/server";
import { postDigestToDiscord } from "@/lib/cot/digest";

export const runtime = "nodejs";

function isAuthorizedCron(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected) return false;
  return bearer === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCron(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const analysisDate = req.nextUrl.searchParams.get("analysisDate") || undefined;
    const row = await postDigestToDiscord({
      analysisDate,
      forceGenerate: false,
    });

    return NextResponse.json({ ok: true, row });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";

    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}