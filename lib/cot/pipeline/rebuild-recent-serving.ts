import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rebuildCotServing } from "@/lib/cot/pipeline/rebuild-serving";

type RecentMarketRow = {
  market_code: string;
};

function cutoffRecent(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function rebuildRecentServing(days = 35) {
  const supabase = getSupabaseAdmin();
  const cutoff = cutoffRecent(days);

  const { data, error } = await supabase
    .from("cot_reports")
    .select("market_code")
    .gte("report_date", cutoff);

  if (error) {
    throw new Error(`Failed to load recent markets: ${error.message}`);
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
    cutoff,
    marketsRebuilt: marketCodes.length,
    marketCodes,
    results,
  };
}