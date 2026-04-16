import { NextRequest, NextResponse } from "next/server";
import { generateDigest } from "@/lib/cot/digest";
import { requireAdminUser } from "@/lib/admin/require-admin";

export const runtime = "nodejs";

function parseAnalysisDate(value: string | null | undefined) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();

    const { searchParams } = new URL(req.url);
    const analysisDate = parseAnalysisDate(searchParams.get("analysisDate"));

    const result = await generateDigest({
      analysisDate,
      force: false,
    });

    return NextResponse.json({
      ok: true,
      cached: result.cached,
      row: result.row,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminUser();

    const body = await req.json().catch(() => ({}));
    const analysisDate = parseAnalysisDate(body?.analysisDate);
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
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 200 }
    );
  }
}