import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { RankedIdeaCandidate, SnapshotRouteRow, WeeklySummaryOutput } from "./types";

function inferEntityType(row: SnapshotRouteRow): string {
  if (row.group === "FX") return "currency";
  if (row.group === "INDEX") return "index";
  if (row.group === "METALS" || row.group === "ENERGY" || row.group === "AGRI") return "commodity";
  if (row.group === "CRYPTO") return "crypto";
  if (row.group === "RATES") return "rate";
  return "asset";
}

function inferMarketGroup(row: SnapshotRouteRow): string {
  if (row.group === "FX") return "fx";
  if (row.group === "INDEX") return "indices";
  if (row.group === "METALS" || row.group === "ENERGY" || row.group === "AGRI") return "commodities";
  if (row.group === "CRYPTO") return "crypto";
  if (row.group === "RATES") return "rates";
  return "other";
}

export async function saveAnalysisRun(params: {
  runKey: string;
  asOfDate: string;
  sourceSnapshot: Record<string, unknown>;
  entityRows: Array<{
    row: SnapshotRouteRow;
    prompt: string;
    summaryText: string;
    cached: boolean;
  }>;
  rankedCandidates: RankedIdeaCandidate[];
  weeklySummary: WeeklySummaryOutput;
}) {
  const supabase = await getSupabaseAdmin();

  const generatedAt = new Date();

  const freshUntil = new Date(generatedAt);
  freshUntil.setUTCDate(freshUntil.getUTCDate() + 3);
  freshUntil.setUTCHours(23, 59, 59, 0);

  const agingAfter = new Date(generatedAt);
  agingAfter.setUTCDate(agingAfter.getUTCDate() + 4);
  agingAfter.setUTCHours(0, 0, 0, 0);

  const expiresAt = new Date(generatedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
  expiresAt.setUTCHours(0, 0, 0, 0);

  const { data: run, error: runError } = await supabase
    .from("analysis_runs")
    .upsert(
      {
        run_key: params.runKey,
        run_type: "weekly_positioning",
        status: "completed",
        as_of_date: params.asOfDate,
        generated_at: generatedAt.toISOString(),
        fresh_until: freshUntil.toISOString(),
        aging_after: agingAfter.toISOString(),
        expires_at: expiresAt.toISOString(),
        model_name: "existing_/api/news/analyze",
        model_version: "v1",
        source_snapshot: params.sourceSnapshot,
        summary_text: params.weeklySummary.summaryText,
        discord_text: params.weeklySummary.discordText,
      },
      { onConflict: "run_key" }
    )
    .select("id")
    .single();

  if (runError) throw runError;

  const runId = run.id;

  const entitySummaryRows = params.entityRows.map(({ row, prompt, summaryText, cached }, idx) => ({
    run_id: runId,
    entity_key: row.code,
    entity_type: inferEntityType(row),
    market_group: inferMarketGroup(row),
    display_name: row.name,
    bias: row.bias ?? null,
    confidence: null,
    summary_text: summaryText,
    source_payload: row,
    prompt_text: prompt,
    ai_cached: cached,
    sort_rank: idx + 1,
  }));

  const { error: entityError } = await supabase
    .from("analysis_entity_summaries")
    .upsert(entitySummaryRows, { onConflict: "run_id,entity_key" });

  if (entityError) throw entityError;

  const tradeIdeaRows = params.weeklySummary.topIdeas.map((idea, idx) => ({
    run_id: runId,
    idea_key: `${idea.symbol}_${idea.direction}_${idx + 1}`,
    idea_type: idea.symbol.length === 6 ? "fx_pair" : "directional",
    market_group: idea.symbol.length === 6 ? "fx" : "other",
    symbol: idea.symbol,
    direction: idea.direction,
    confidence: idea.confidence,
    idea_score: params.rankedCandidates.find(
      (x) => x.symbol === idea.symbol && x.direction === idea.direction
    )?.score ?? null,
    base_entity_key: idea.symbol.length === 6 ? idea.symbol.slice(0, 3) : null,
    quote_entity_key: idea.symbol.length === 6 ? idea.symbol.slice(3, 6) : null,
    title: idea.title,
    summary_text: idea.summaryText,
    why_text: idea.whyText,
    invalidation_text: idea.invalidationText,
    risk_text: idea.riskText,
    source_payload: params.rankedCandidates.find(
      (x) => x.symbol === idea.symbol && x.direction === idea.direction
    ) ?? {},
    ai_response: idea,
    rank_position: idx + 1,
    is_top_5: idx < 5,
    is_top_10: idx < 10,
  }));

  if (tradeIdeaRows.length) {
    const { error: tradeError } = await supabase
      .from("analysis_trade_ideas")
      .upsert(tradeIdeaRows, { onConflict: "run_id,idea_key" });

    if (tradeError) throw tradeError;
  }

  return { runId };
}

export async function markDiscordPosted(runId: string) {
  const supabase = await getSupabaseAdmin();

  const { error } = await supabase
    .from("analysis_runs")
    .update({
      discord_posted_at: new Date().toISOString(),
      discord_message_count: 1,
    })
    .eq("id", runId);

  if (error) throw error;
}