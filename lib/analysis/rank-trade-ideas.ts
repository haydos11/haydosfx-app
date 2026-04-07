import type { RankedIdeaCandidate, SnapshotRouteRow } from "./types";

const FX_CODES = ["EUR", "JPY", "GBP", "AUD", "NZD", "CAD", "CHF", "USD"];

// Standard FX ordering (industry convention)
const MAJOR_ORDER = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"];

function isFxCode(code: string) {
  return FX_CODES.includes(code.toUpperCase());
}

function getOrder(code: string) {
  const idx = MAJOR_ORDER.indexOf(code.toUpperCase());
  return idx === -1 ? 999 : idx;
}

// 🔥 Normalize pair to tradable format
function normalizePair(
  base: string,
  quote: string,
  direction: "long" | "short"
): { symbol: string; direction: "long" | "short" } {
  const baseRank = getOrder(base);
  const quoteRank = getOrder(quote);

  // already correct (e.g. EURUSD)
  if (baseRank < quoteRank) {
    return {
      symbol: `${base}${quote}`,
      direction,
    };
  }

  // flip pair (e.g. AUDGBP → GBPAUD)
  return {
    symbol: `${quote}${base}`,
    direction: direction === "long" ? "short" : "long",
  };
}

function scoreRow(row: SnapshotRouteRow): number {
  let score = 50;

  if (row.bias === "bullish") score += 20;
  if (row.bias === "bearish") score -= 20;

  if (typeof row.weeklyChange === "number") {
    score += Math.max(-15, Math.min(15, row.weeklyChange / 5000));
  }

  if (typeof row.netPctOi === "number") {
    score += Math.max(-10, Math.min(10, row.netPctOi / 3));
  }

  if (row.reaction === "confirmation") score += 10;
  if (row.reaction === "fade") score -= 8;

  if (typeof row.movePct === "number") {
    score += Math.max(-5, Math.min(5, row.movePct * 2));
  }

  return Math.round(score * 100) / 100;
}

function confidenceFromSpread(
  spread: number
): "very_high" | "high" | "medium" | "low" {
  if (spread >= 45) return "very_high";
  if (spread >= 30) return "high";
  if (spread >= 18) return "medium";
  return "low";
}

export function rankTradeIdeaCandidates(
  rows: SnapshotRouteRow[]
): RankedIdeaCandidate[] {
  const fxRows = rows
    .filter((r) => isFxCode(r.code))
    .map((r) => ({ row: r, score: scoreRow(r) }));

  const ideas: RankedIdeaCandidate[] = [];

  for (let i = 0; i < fxRows.length; i += 1) {
    for (let j = 0; j < fxRows.length; j += 1) {
      if (i === j) continue;

      const a = fxRows[i];
      const b = fxRows[j];

      const spread = a.score - b.score;
      if (spread < 18) continue;

      // 🔥 Normalize pair BEFORE pushing
      const normalized = normalizePair(
        a.row.code,
        b.row.code,
        "long"
      );

      ideas.push({
        ideaKey: `${normalized.symbol}_${normalized.direction}`,
        symbol: normalized.symbol,
        direction: normalized.direction,
        score: Math.round(spread * 100) / 100,
        longCode: a.row.code,
        shortCode: b.row.code,
        rationale: `${a.row.code} scores better on positioning bias, weekly change, and reaction profile than ${b.row.code}.`,
      });
    }
  }

  // dedupe best ideas
  const dedup = new Map<string, RankedIdeaCandidate>();
  for (const idea of ideas) {
    const existing = dedup.get(idea.ideaKey);
    if (!existing || idea.score > existing.score) {
      dedup.set(idea.ideaKey, idea);
    }
  }

  return [...dedup.values()].sort((a, b) => b.score - a.score);
}

export function topIdeasToAiCandidates(
  candidates: RankedIdeaCandidate[]
) {
  return candidates.slice(0, 10).map((c) => ({
    ...c,
    confidence: confidenceFromSpread(c.score),
  }));
}