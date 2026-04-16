import type { SupabaseClient } from "@supabase/supabase-js";

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "NZD",
  "CAD",
  "CHF",
  "JPY",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];
export type SourceTf = "M5" | "H1";

export const PAIRS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY",
  "EURGBP",
  "EURAUD",
  "EURNZD",
  "EURCAD",
  "EURCHF",
  "EURJPY",
  "GBPAUD",
  "GBPNZD",
  "GBPCAD",
  "GBPCHF",
  "GBPJPY",
  "AUDNZD",
  "AUDCAD",
  "AUDCHF",
  "AUDJPY",
  "NZDCAD",
  "NZDCHF",
  "NZDJPY",
  "CADCHF",
  "CADJPY",
  "CHFJPY",
] as const;

export type PairCode = (typeof PAIRS)[number];

export type CandleRow = {
  symbol: string;
  timeframe: string;
  time: string;
  close: number;
};

export type StrengthPoint = {
  time: string;
  values: Record<CurrencyCode, number>;
};

export type CurrencyFlowSummary = {
  byCurrency: Record<CurrencyCode, number>;
  betaScore: number;
  defensiveReleaseScore: number;
  usdScore: number;
  overallScore: number;
  leaders: CurrencyCode[];
  laggards: CurrencyCode[];
  betaLabel: "supportive" | "mixed" | "defensive";
  defensiveLabel: "released" | "mixed" | "firm";
  usdLabel: "soft" | "neutral" | "firm";
};

const PAIR_COMPONENTS: Record<PairCode, [CurrencyCode, CurrencyCode]> = {
  EURUSD: ["EUR", "USD"],
  GBPUSD: ["GBP", "USD"],
  AUDUSD: ["AUD", "USD"],
  NZDUSD: ["NZD", "USD"],
  USDCAD: ["USD", "CAD"],
  USDCHF: ["USD", "CHF"],
  USDJPY: ["USD", "JPY"],
  EURGBP: ["EUR", "GBP"],
  EURAUD: ["EUR", "AUD"],
  EURNZD: ["EUR", "NZD"],
  EURCAD: ["EUR", "CAD"],
  EURCHF: ["EUR", "CHF"],
  EURJPY: ["EUR", "JPY"],
  GBPAUD: ["GBP", "AUD"],
  GBPNZD: ["GBP", "NZD"],
  GBPCAD: ["GBP", "CAD"],
  GBPCHF: ["GBP", "CHF"],
  GBPJPY: ["GBP", "JPY"],
  AUDNZD: ["AUD", "NZD"],
  AUDCAD: ["AUD", "CAD"],
  AUDCHF: ["AUD", "CHF"],
  AUDJPY: ["AUD", "JPY"],
  NZDCAD: ["NZD", "CAD"],
  NZDCHF: ["NZD", "CHF"],
  NZDJPY: ["NZD", "JPY"],
  CADCHF: ["CAD", "CHF"],
  CADJPY: ["CAD", "JPY"],
  CHFJPY: ["CHF", "JPY"],
};

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rebaseSeries(values: number[]): number[] {
  if (!values.length) return [];
  const base = values[0];
  if (!Number.isFinite(base) || base === 0) return values.map(() => 0);
  return values.map((v) => ((v / base) - 1) * 100);
}

function getContributionForCurrency(
  pair: PairCode,
  currency: CurrencyCode,
  pairMove: number
) {
  const [base, quote] = PAIR_COMPONENTS[pair];
  if (currency === base) return pairMove;
  if (currency === quote) return -pairMove;
  return null;
}

export function buildStrength(
  rowsByPair: Partial<Record<PairCode, CandleRow[]>>
): StrengthPoint[] {
  const availablePairs = PAIRS.filter(
    (pair) => Array.isArray(rowsByPair[pair]) && (rowsByPair[pair]?.length ?? 0) > 1
  );

  if (!availablePairs.length) return [];

  const lengths = availablePairs.map((pair) => rowsByPair[pair]!.length);
  const minLen = Math.min(...lengths);
  if (minLen < 2) return [];

  const trimmed: Partial<Record<PairCode, CandleRow[]>> = {};
  const pairMoves: Partial<Record<PairCode, number[]>> = {};

  for (const pair of availablePairs) {
    const rows = rowsByPair[pair]!.slice(-minLen);
    trimmed[pair] = rows;
    pairMoves[pair] = rebaseSeries(rows.map((r) => Number(r.close)));
  }

  const result: StrengthPoint[] = [];

  for (let i = 0; i < minLen; i++) {
    const values = {} as Record<CurrencyCode, number>;

    for (const currency of CURRENCIES) {
      const signed: number[] = [];

      for (const pair of availablePairs) {
        const moveSeries = pairMoves[pair];
        if (!moveSeries) continue;

        const contribution = getContributionForCurrency(pair, currency, moveSeries[i]);
        if (contribution === null) continue;
        signed.push(contribution);
      }

      values[currency] = signed.length ? mean(signed) : 0;
    }

    const time = trimmed[availablePairs[0]]?.[i]?.time ?? "";
    result.push({ time, values });
  }

  return result;
}

export async function fetchFxPairCandles(
  supabase: SupabaseClient,
  timeframe: SourceTf,
  limit: number
): Promise<Partial<Record<PairCode, CandleRow[]>>> {
  const rowsByPair: Partial<Record<PairCode, CandleRow[]>> = {};

  const { data, error } = await supabase
    .from("fx_candles")
    .select("symbol,timeframe,time,close")
    .in("symbol", [...PAIRS])
    .eq("timeframe", timeframe)
    .order("time", { ascending: false })
    .limit(PAIRS.length * limit);

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, CandleRow[]>();

  for (const row of (data ?? []) as CandleRow[]) {
    const arr = grouped.get(row.symbol) ?? [];
    if (arr.length < limit) arr.push(row);
    grouped.set(row.symbol, arr);
  }

  for (const pair of PAIRS) {
    const rows = (grouped.get(pair) ?? []).slice().reverse();
    if (rows.length) rowsByPair[pair] = rows;
  }

  return rowsByPair;
}

function normalizeLatest(values: Record<CurrencyCode, number>) {
  const out = {} as Record<CurrencyCode, number>;
  for (const ccy of CURRENCIES) {
    out[ccy] = clamp(values[ccy] / 2.5, -1, 1);
  }
  return out;
}

function flowLabel(value: number, positive: string, neutral: string, negative: string) {
  if (value >= 0.2) return positive;
  if (value <= -0.2) return negative;
  return neutral;
}

export function summarizeIntradayCurrencyFlows(
  m5Points: StrengthPoint[],
  h1Points: StrengthPoint[]
): CurrencyFlowSummary | null {
  const lastM5 = m5Points[m5Points.length - 1];
  const lastH1 = h1Points[h1Points.length - 1];

  if (!lastM5 && !lastH1) return null;

  const m5Norm = normalizeLatest(
    lastM5?.values ??
      ({
        USD: 0,
        EUR: 0,
        GBP: 0,
        AUD: 0,
        NZD: 0,
        CAD: 0,
        CHF: 0,
        JPY: 0,
      } as Record<CurrencyCode, number>)
  );

  const h1Norm = normalizeLatest(
    lastH1?.values ??
      ({
        USD: 0,
        EUR: 0,
        GBP: 0,
        AUD: 0,
        NZD: 0,
        CAD: 0,
        CHF: 0,
        JPY: 0,
      } as Record<CurrencyCode, number>)
  );

  const byCurrency = {} as Record<CurrencyCode, number>;
  for (const ccy of CURRENCIES) {
    byCurrency[ccy] = clamp((m5Norm[ccy] * 0.6) + (h1Norm[ccy] * 0.4), -1, 1);
  }

  const betaScore = mean([byCurrency.AUD, byCurrency.NZD, byCurrency.CAD]);
  const defensiveReleaseScore = mean([-byCurrency.JPY, -byCurrency.CHF]);
  const usdScore = byCurrency.USD;
  const overallScore = clamp((betaScore * 0.5) + (defensiveReleaseScore * 0.5), -1.5, 1.5);

  const leaders = [...CURRENCIES]
    .sort((a, b) => byCurrency[b] - byCurrency[a])
    .slice(0, 3);

  const laggards = [...CURRENCIES]
    .sort((a, b) => byCurrency[a] - byCurrency[b])
    .slice(0, 3);

  return {
    byCurrency,
    betaScore,
    defensiveReleaseScore,
    usdScore,
    overallScore,
    leaders,
    laggards,
    betaLabel: flowLabel(betaScore, "supportive", "mixed", "defensive") as
      | "supportive"
      | "mixed"
      | "defensive",
    defensiveLabel: flowLabel(defensiveReleaseScore, "released", "mixed", "firm") as
      | "released"
      | "mixed"
      | "firm",
    usdLabel: flowLabel(-usdScore, "soft", "neutral", "firm") as
      | "soft"
      | "neutral"
      | "firm",
  };
}