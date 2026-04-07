export type AnalyzeRequest = {
  click: true;
  force: boolean;
  noStyle: true;
  testPrompt?: string;
};

export type AnalyzeResponse = {
  ok: boolean;
  text?: string;
  cached?: boolean;
  error?: string;
};

export type SnapshotRouteRow = {
  market_code: string;
  key: string;
  code: string;
  name: string;
  group: string | null;
  category: string | null;
  date: string | null;

  longPct: number | null;
  prevLongPct: number | null;
  shortPct: number | null;
  prevShortPct: number | null;

  marketBias: "bullish" | "bearish" | "neutral" | null;
  sentiment: string | null;

  netContracts: number | null;
  prevNet: number | null;
  changePct: number | null;
  weeklyChange: number | null;
  netPctOi: number | null;

  usdDirectional: number | null;
  prevUsdDirectional: number | null;

  bias: "bullish" | "bearish" | "neutral" | null;
  reportPrice: number | null;
  releasePrice: number | null;
  movePct: number | null;
  priceDirection: string | null;
  reaction: string | null;
};

export type SnapshotRouteResponse = {
  updated: string;
  date: string | null;
  count: number;
  rows: SnapshotRouteRow[];
};

export type RankedIdeaCandidate = {
  ideaKey: string;
  symbol: string;
  direction: "long" | "short";
  score: number;
  rationale: string;
  longCode: string;
  shortCode: string;
};

export type WeeklySummaryOutput = {
  headline: string;
  summaryText: string;
  discordText: string;
  topIdeas: Array<{
    symbol: string;
    direction: "long" | "short";
    confidence: "very_high" | "high" | "medium" | "low";
    title: string;
    summaryText: string;
    whyText: string;
    invalidationText: string;
    riskText: string;
  }>;
};