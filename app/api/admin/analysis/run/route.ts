import { NextRequest, NextResponse } from "next/server";
import { fetchRealSnapshotRows } from "@/lib/analysis/fetch-real-snapshot";
import { buildSnapshotEntityPrompt } from "@/lib/analysis/prompts";
import { callExistingAnalyze } from "@/lib/analysis/call-existing-analyze";
import {
  rankTradeIdeaCandidates,
  topIdeasToAiCandidates,
} from "@/lib/analysis/rank-trade-ideas";
import {
  saveAnalysisRun,
  markDiscordPosted,
} from "@/lib/analysis/save-analysis-run";
import { postDiscordSummary } from "@/lib/analysis/post-discord-summary";
import type { SnapshotRouteRow } from "@/lib/analysis/types";
import { generateWeeklySummary } from "@/lib/analysis/generate-weekly-summary";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const adminToken = process.env.ANALYSIS_ADMIN_TOKEN;
  const providedToken = req.headers.get("x-analysis-token");

  if (!adminToken || providedToken !== adminToken) {
    return unauthorized();
  }

  try {
    const origin = new URL(req.url).origin;
    const body = await req.json().catch(() => ({}));

    const force = Boolean(body.force ?? false);
    const postToDiscord = Boolean(body.postToDiscord ?? false);
    const limit = Math.max(1, Math.min(Number(body.limit ?? 4), 20));
    const codes = Array.isArray(body.codes)
      ? body.codes.map((x: unknown) => String(x).toUpperCase())
      : null;

    const snapshot = await fetchRealSnapshotRows(origin);

    let rows: SnapshotRouteRow[] = snapshot.rows;

    if (codes && codes.length > 0) {
      rows = rows.filter((r) => codes.includes(String(r.code).toUpperCase()));
    }

    rows = rows.slice(0, limit);

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "No snapshot rows matched the requested filter" },
        { status: 400 }
      );
    }

    const runKey = `weekly_positioning_${snapshot.asOfDate}_${rows
      .map((r) => r.code)
      .join("_")}`;

    const entityRows: Array<{
      row: SnapshotRouteRow;
      prompt: string;
      summaryText: string;
      cached: boolean;
    }> = [];

    for (const row of rows) {
      console.log("[analysis/run] analyzing entity", row.code);

      const prompt = buildSnapshotEntityPrompt(row);
      const result = await callExistingAnalyze({
        origin,
        prompt,
        force,
      });

      entityRows.push({
        row,
        prompt,
        summaryText: result.text,
        cached: result.cached,
      });
    }

    console.log("[analysis/run] building ranked candidates");
    const rankedCandidates = rankTradeIdeaCandidates(rows);
    const aiCandidates = topIdeasToAiCandidates(rankedCandidates);

    console.log("[analysis/run] generating weekly summary");
    const weeklySummary = await generateWeeklySummary({
      asOfDate: snapshot.asOfDate,
      entitySummaries: entityRows.map(({ row, summaryText }) => ({
        asset: row.name,
        code: row.code,
        bias: row.bias,
        sentiment: row.sentiment,
        summaryText,
      })),
      rankedCandidates: aiCandidates,
    });

    const saved = await saveAnalysisRun({
      runKey,
      asOfDate: snapshot.asOfDate,
      sourceSnapshot: {
        source: "/api/cot/test-snapshot",
        updated: snapshot.updated,
        snapshotCount: snapshot.rows.length,
        analyzedCount: rows.length,
        analyzedCodes: rows.map((r) => r.code),
        rankedCandidateCount: rankedCandidates.length,
      },
      entityRows,
      rankedCandidates,
      weeklySummary,
    });

    if (postToDiscord) {
      await postDiscordSummary(weeklySummary.discordText);
      await markDiscordPosted(saved.runId);
    }

    return NextResponse.json({
      ok: true,
      runId: saved.runId,
      runKey,
      asOfDate: snapshot.asOfDate,
      entityCount: entityRows.length,
      analyzedCodes: rows.map((r) => r.code),
      rankedCandidateCount: rankedCandidates.length,
      postedToDiscord: postToDiscord,
      previewHeadline: weeklySummary.headline,
      previewDiscordText: weeklySummary.discordText,
    });
  } catch (error) {
    console.error("[analysis/run] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}