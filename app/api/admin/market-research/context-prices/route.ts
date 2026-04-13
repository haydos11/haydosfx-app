import { NextRequest, NextResponse } from "next/server";
import {
  getMarketContextPrices,
  groupMarketContextPrices,
} from "@/lib/market-research/get-market-context-prices";

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const assetClasses = parseCsv(searchParams.get("assetClasses"));
    const assetCodes = parseCsv(searchParams.get("assetCodes"));

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { ok: false, error: "dateFrom and dateTo are required" },
        { status: 400 }
      );
    }

    const rows = await getMarketContextPrices({
      dateFrom,
      dateTo,
      assetClasses,
      assetCodes,
    });

    const grouped = groupMarketContextPrices(rows);

    return NextResponse.json({
      ok: true,
      rows,
      grouped,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}