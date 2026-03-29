import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const LABEL_BY_CODE: Record<string, string> = {
  "6A": "AUD",
  "6C": "CAD",
  "6S": "CHF",
  "6E": "EUR",
  "6B": "GBP",
  "6J": "JPY",
  "6N": "NZD",
  "6M": "MXN",
};

const FX_CODES = Object.keys(LABEL_BY_CODE);

function cutoffFor(range: string): string | null {
  const now = new Date();

  switch (range) {
    case "1y":
      now.setUTCFullYear(now.getUTCFullYear() - 1);
      return now.toISOString().slice(0, 10);
    case "ytd":
      return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
        .toISOString()
        .slice(0, 10);
    case "3y":
      now.setUTCFullYear(now.getUTCFullYear() - 3);
      return now.toISOString().slice(0, 10);
    case "5y":
      now.setUTCFullYear(now.getUTCFullYear() - 5);
      return now.toISOString().slice(0, 10);
    default:
      return null;
  }
}

type Row = {
  report_date: string;
  market_code: string;
  usd_signed_exposure: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const range = (req.nextUrl.searchParams.get("range") ?? "1y").toLowerCase();
    const startDate = cutoffFor(range);

    let query = supabase
      .from("cot_market_history_serving")
      .select(`
        report_date,
        market_code,
        usd_signed_exposure
      `)
      .in("market_code", FX_CODES)
      .order("report_date", { ascending: true });

    if (startDate) {
      query = query.gte("report_date", startDate);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Row[];

    const byDate = new Map<string, Record<string, number | null>>();

    for (const row of rows) {
      if (!byDate.has(row.report_date)) {
        byDate.set(row.report_date, {});
      }

      const label = LABEL_BY_CODE[row.market_code] ?? row.market_code;
      byDate.get(row.report_date)![label] = row.usd_signed_exposure;
    }

    const dates = Array.from(byDate.keys()).sort();

    const points = dates.map((date) => ({
      date,
      values: byDate.get(date) ?? {},
    }));

    return NextResponse.json({
      updated: new Date().toISOString(),
      range,
      count: points.length,
      points,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 500 });
  }
}