import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rebuildCotServing } from "@/lib/cot/pipeline/rebuild-serving";

type RecentMarketRow = {
  market_code: string;
};

export async function rebuildRecentServing() {
  const supabase = getSupabaseAdmin();

  const { data: latestRow, error: latestError } = await supabase
    .from("cot_reports")
    .select("report_date")
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`Failed to load latest report date: ${latestError.message}`);
  }

  const latestReportDate = latestRow?.report_date
    ? String(latestRow.report_date).slice(0, 10)
    : null;

  if (!latestReportDate) {
    return {
      ok: true,
      latestReportDate: null,
      marketsRebuilt: 0,
      marketCodes: [],
      results: [],
    };
  }

  const { data, error } = await supabase
    .from("cot_reports")
    .select("market_code")
    .eq("report_date", latestReportDate);

  if (error) {
    throw new Error(`Failed to load latest-report markets: ${error.message}`);
  }

  const marketCodes = Array.from(
    new Set(
      ((data ?? []) as RecentMarketRow[])
        .map((r) => String(r.market_code ?? "").toUpperCase())
        .filter(Boolean)
    )
  ).sort();

  const results = [];
  for (const marketCode of marketCodes) {
    const rebuilt = await rebuildCotServing(marketCode);
    results.push(rebuilt);
  }

  return {
    ok: true,
    latestReportDate,
    marketsRebuilt: marketCodes.length,
    marketCodes,
    results,
  };
}