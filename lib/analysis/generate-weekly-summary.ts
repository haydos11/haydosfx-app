import OpenAI from "openai";
import type { RankedIdeaCandidate, WeeklySummaryOutput } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.ANALYSIS_MODEL || "gpt-4o-mini";

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
    "",
    "JSON INPUT:",
    "```json",
    JSON.stringify(params, null, 2),
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

  return JSON.parse(text) as WeeklySummaryOutput;
}