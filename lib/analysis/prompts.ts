import type { RankedIdeaCandidate, SnapshotRouteRow } from "./types";

export function buildSnapshotEntityPrompt(input: SnapshotRouteRow) {
  const compact = {
    asset: input.name,
    code: input.code,
    group: input.group ?? null,
    latestDate: input.date ?? null,

    latestNet: input.netContracts ?? null,
    prevNet: input.prevNet ?? null,
    weeklyChange: input.weeklyChange ?? null,

    longPct: input.longPct ?? null,
    shortPct: input.shortPct ?? null,
    netPctOi: input.netPctOi ?? null,

    latestLargeUsd: input.usdDirectional ?? null,
    prevLargeUsd: input.prevUsdDirectional ?? null,

    reportPrice: input.reportPrice ?? null,
    releasePrice: input.releasePrice ?? null,
    movePct: input.movePct ?? null,
    priceDirection: input.priceDirection ?? null,
    reactionType: input.reaction ?? null,

    marketBias: input.marketBias ?? null,
    sentiment: input.sentiment ?? null,
    changePct: input.changePct ?? null,
  };

  const jsonBlock = JSON.stringify(compact, null, 2);

  return [
    "You are a senior macro strategist and futures positioning analyst.",
    "Use only the provided JSON facts.",
    "Do not invent missing data.",
    "Be concise, analytical, and trader-relevant.",
    "",
    "JSON INPUT:",
    "```json",
    jsonBlock,
    "```",
    "",
    "Interpretation priorities:",
    "1. Explain speculative positioning direction, depth, and weekly change.",
    "2. Explain whether positioning is becoming more bullish, less bullish, more bearish, or less bearish using the provided facts.",
    "3. Judge crowding/stretch using netPctOi where available.",
    "4. Compare positioning with price reaction into release.",
    "5. Explain whether the move confirmed or faded the positioning view.",
    "6. State clearly whether this market currently looks bullish, bearish, or neutral from a positioning perspective.",
    "",
    "Write the output in these exact sections:",
    "### Positioning summary",
    "### What changed this week",
    "### Crowd / stretch assessment",
    "### Price reaction into release",
    "### Relative strength / cross-market read",
    "### Trading takeaway",
    "",
    "Rules:",
    "- Write 8 to 10 bullets total.",
    "- No filler.",
    "- Complete all sections.",
    "- Keep each bullet concrete and fairly short.",
    "- If cross-market data is not available, say relative strength is limited in this snapshot.",
  ].join("\n");
}

export function buildWeeklySummaryPrompt(params: {
  asOfDate: string;
  entitySummaries: Array<{
    asset: string;
    code: string;
    bias: string | null;
    sentiment: string | null;
    summaryText: string;
  }>;
  rankedCandidates: RankedIdeaCandidate[];
}) {
  const payload = {
    asOfDate: params.asOfDate,
    entitySummaries: params.entitySummaries,
    rankedCandidates: params.rankedCandidates,
  };

  return [
    "You are a senior macro strategist creating a weekly positioning briefing.",
    "Use only the provided JSON facts.",
    "Do not invent missing data.",
    "Return STRICT JSON only. No markdown fences.",
    "",
    "Required JSON shape:",
    "{",
    '  "headline": "string",',
    '  "summaryText": "string",',
    '  "discordText": "string",',
    '  "topIdeas": [',
    "    {",
    '      "symbol": "string",',
    '      "direction": "long" | "short",',
    '      "confidence": "very_high" | "high" | "medium" | "low",',
    '      "title": "string",',
    '      "summaryText": "string",',
    '      "whyText": "string",',
    '      "invalidationText": "string",',
    '      "riskText": "string"',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "1. Build the weekly summary from the provided entity summaries and ranked trade candidates.",
    "2. topIdeas should contain up to 5 ideas.",
    "3. discordText should be nicely formatted for a Discord channel.",
    "4. Mention that the analysis is fresh into Tuesday and ages after Wednesday.",
    "5. Give clear reasons why the top ideas stand out.",
    "",
    "JSON INPUT:",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}