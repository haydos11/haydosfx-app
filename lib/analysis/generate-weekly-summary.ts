import OpenAI from "openai";
import type { RankedIdeaCandidate, WeeklySummaryOutput } from "./types";
import { normalizeIdeaSymbol, type TradeDirection } from "@/lib/fx/symbols";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.ANALYSIS_MODEL || "gpt-4o-mini";

function normalizeCandidateIdea<T extends { symbol: string; direction: string }>(
  idea: T
): T {
  const direction =
    idea.direction === "long" || idea.direction === "short"
      ? (idea.direction as TradeDirection)
      : null;

  if (!direction) return idea;

  const normalized = normalizeIdeaSymbol(idea.symbol, direction);
  if (!normalized) return idea;

  return {
    ...idea,
    symbol: normalized.symbol,
    direction: normalized.direction,
  };
}

export async function generateWeeklySummary(params: {
  asOfDate: string;
  entitySummaries: Array<{
    asset: string;
    code: string;
    bias: string | null;
    sentiment: string | null;
    summaryText: string;
  }>;
  rankedCandidates: RankedIdeaCandidate[];
}): Promise<WeeklySummaryOutput> {
  const normalizedCandidates = (params.rankedCandidates ?? []).map((candidate) =>
    normalizeCandidateIdea(candidate)
  );

  const promptPayload = {
    ...params,
    rankedCandidates: normalizedCandidates,
  };

  const prompt = [
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
    "6. For FX ideas, always use standard market pair notation.",
    "7. If an FX pair is provided in reversed form, convert it to the conventional symbol and flip long/short direction accordingly.",
    "8. Do not output non-standard FX symbols such as CADNZD if the conventional market symbol is NZDCAD.",
    "",
    "JSON INPUT:",
    "```json",
    JSON.stringify(promptPayload, null, 2),
    "```",
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Return only valid JSON matching the requested shape.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";

  if (!text.trim()) {
    throw new Error("Weekly summary model returned empty content");
  }

  const parsed = JSON.parse(text) as WeeklySummaryOutput;

  parsed.topIdeas = (parsed.topIdeas ?? []).map((idea) =>
    normalizeCandidateIdea(idea)
  );

  return parsed;
}