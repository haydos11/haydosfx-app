import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/cot/digest";
import { requireAdminUser } from "@/lib/admin/require-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();

    const body = await req.json().catch(() => ({}));
    const analysisDate =
      typeof body?.analysisDate === "string" && body.analysisDate.trim()
        ? body.analysisDate.trim()
        : undefined;
    const force = body?.force === true;

    const result = await generateDigest({
      analysisDate,
      force,
    });

    return NextResponse.json({
      ok: true,
      cached: result.cached,
      row: result.row,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 200 }
    );
  }
}