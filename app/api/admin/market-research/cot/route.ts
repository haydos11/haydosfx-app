import { NextRequest, NextResponse } from "next/server";
import { getCotResearchForDate } from "@/lib/market-research/get-cot-research";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const analysisDate = searchParams.get("analysisDate") || undefined;

    const result = await getCotResearchForDate(analysisDate);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load COT research",
      },
      { status: 500 }
    );
  }
}