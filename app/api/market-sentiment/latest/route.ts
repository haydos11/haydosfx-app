import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotComponent = {
  score: number;
  latestChange: number | null;
  hourChange: number | null;
  rolling2hChange?: number | null;
  rolling4hChange?: number | null;
  previousDaySameTimeChange?: number | null;
  londonChange: number | null;
  sessionChange: number | null;
  direction: "risk_on" | "risk_off" | "neutral";
};

type SnapshotRow = {
  ts: string;
  regime: string;
  score: number;
  breadth: number;
  improving: boolean;
  degrading: boolean;
  confidence: number;
  previous_score_change: number | null;
  london_change_score: number | null;
  session_change_score: number | null;
  previous_day_same_time_score_change?: number | null;
  rolling_2h_score_change?: number | null;
  rolling_4h_score_change?: number | null;
  summary_text: string;
  components: Record<string, SnapshotComponent>;
};

type HistoryRow = {
  ts: string;
  score: number;
  regime: string;
  breadth: number;
};

type PriceRowRaw = {
  ts: string;
  asset_code: string;
  asset_name: string;
  asset_class: string;
  price: number;
  prev_15m_change_pct: number | null;
  hour_change_pct: number | null;
  rolling_2h_change_pct?: number | null;
  rolling_4h_change_pct?: number | null;
  previous_day_same_time_change_pct?: number | null;
  london_change_pct: number | null;
  session_change_pct: number | null;
};

type PriceRow = PriceRowRaw & {
  daily_change_pct: number | null;
};

type SleeveKey =
  | "equities"
  | "fxCarry"
  | "vol"
  | "rates"
  | "commodities";

type SleeveSummary = {
  key: SleeveKey;
  label: string;
  score: number;
  normalized: number;
  state:
    | "supportive"
    | "mild_supportive"
    | "mixed"
    | "mild_defensive"
    | "defensive";
  agreement: number;
  leaders: string[];
  laggards: string[];
};

type Interpretation = {
  sleeves: Record<SleeveKey, SleeveSummary>;
  tapeQuality:
    | "broad_supportive"
    | "narrow_supportive"
    | "mixed"
    | "defensive_divergence"
    | "broad_defensive";
  tradeTranslation: string;
  bestExpressions: string[];
  warningFlags: string[];
};

type LatestResponse = {
  ok: true;
  snapshot: SnapshotRow | null;
  prices: PriceRow[];
  history: HistoryRow[];
  interpretation?: Interpretation | null;
};

function toMs(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

function pctChange(
  current: number | null | undefined,
  base: number | null | undefined
) {
  if (
    current == null ||
    base == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(base) ||
    base === 0
  ) {
    return null;
  }

  return ((current - base) / base) * 100;
}

function pickNearestBaseline(
  rows: PriceRowRaw[],
  targetMs: number,
  maxGapMs: number
): PriceRowRaw | null {
  let best: PriceRowRaw | null = null;
  let bestGap = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const ms = toMs(row.ts);
    if (ms == null) continue;

    const gap = Math.abs(ms - targetMs);
    if (gap <= maxGapMs && gap < bestGap) {
      best = row;
      bestGap = gap;
    }
  }

  return best;
}

function enrichLatestRow(latest: PriceRowRaw, series: PriceRowRaw[]): PriceRow {
  const latestMs = toMs(latest.ts);
  const fallbackFromColumn = latest.previous_day_same_time_change_pct ?? null;

  if (latestMs == null) {
    return {
      ...latest,
      daily_change_pct: fallbackFromColumn,
    };
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  const maxGapMs = 3 * 60 * 60 * 1000;

  const baselineDaily = pickNearestBaseline(series, latestMs - oneDayMs, maxGapMs);
  const computedDaily =
    baselineDaily != null ? pctChange(latest.price, baselineDaily.price) : null;

  return {
    ...latest,
    daily_change_pct: computedDaily ?? fallbackFromColumn,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifySleeveState(
  score: number
): SleeveSummary["state"] {
  if (score >= 1.1) return "supportive";
  if (score >= 0.35) return "mild_supportive";
  if (score <= -1.1) return "defensive";
  if (score <= -0.35) return "mild_defensive";
  return "mixed";
}

function normalizedFromScore(score: number) {
  return clamp(50 + score * 18, 0, 100);
}

function computeAssetSignal(
  score: number,
  row: PriceRow
) {
  const latest = clamp((row.prev_15m_change_pct ?? 0) / 0.35, -1, 1);
  const hour = clamp((row.hour_change_pct ?? 0) / 0.7, -1, 1);
  const daily = clamp((row.daily_change_pct ?? 0) / 1.6, -1, 1);
  const london = clamp((row.london_change_pct ?? 0) / 1.1, -1, 1);
  const session = clamp((row.session_change_pct ?? 0) / 1.1, -1, 1);

  return score + latest * 0.18 + hour * 0.28 + daily * 0.32 + london * 0.14 + session * 0.14;
}

function readableName(code: string, fallback: string) {
  const map: Record<string, string> = {
    SPY: "SPX500",
    QQQ: "NAS100",
    JP225: "JPN225",
    GER40: "GER40",
    FRA40: "FRA40",
    AUDJPY: "AUDJPY",
    USDJPY: "USDJPY",
    EURCHF: "EURCHF",
    VIX: "VIX",
    TLT: "Long Bonds",
    US10Y: "US 10Y",
    US2Y: "US 2Y",
    COPPER: "Copper",
    WTI: "WTI",
    XAUUSD: "Gold",
  };
  return map[code] ?? fallback;
}

function buildInterpretation(
  prices: PriceRow[],
  components: Record<string, SnapshotComponent>
): Interpretation {
  const rowByCode = new Map(prices.map((row) => [row.asset_code, row]));

  const groups: Record<SleeveKey, { label: string; codes: string[] }> = {
    equities: {
      label: "Equities",
      codes: ["SPY", "QQQ", "GER40", "FRA40", "JP225"],
    },
    fxCarry: {
      label: "FX Carry",
      codes: ["AUDJPY", "USDJPY", "EURCHF"],
    },
    vol: {
      label: "Vol / Fear",
      codes: ["VIX"],
    },
    rates: {
      label: "Rates / Bonds",
      codes: ["TLT", "US10Y", "US2Y"],
    },
    commodities: {
      label: "Commodities",
      codes: ["COPPER", "WTI", "XAUUSD"],
    },
  };

  const sleeves = {} as Record<SleeveKey, SleeveSummary>;

  for (const key of Object.keys(groups) as SleeveKey[]) {
    const group = groups[key];

    const members = group.codes
      .map((code) => {
        const row = rowByCode.get(code);
        const component = components[code];
        if (!row || !component) return null;

        const signal = computeAssetSignal(component.score ?? 0, row);

        return {
          code,
          name: readableName(code, row.asset_name),
          signal,
          direction: component.direction,
        };
      })
      .filter(Boolean) as Array<{
      code: string;
      name: string;
      signal: number;
      direction: "risk_on" | "risk_off" | "neutral";
    }>;

    const score = mean(members.map((m) => m.signal));
    const supportiveCount = members.filter((m) => m.signal > 0.35).length;
    const defensiveCount = members.filter((m) => m.signal < -0.35).length;
    const agreement =
      members.length > 0
        ? Math.max(supportiveCount, defensiveCount) / members.length
        : 0;

    const sorted = [...members].sort((a, b) => b.signal - a.signal);

    sleeves[key] = {
      key,
      label: group.label,
      score,
      normalized: normalizedFromScore(score),
      state: classifySleeveState(score),
      agreement,
      leaders: sorted.slice(0, 2).map((m) => m.name),
      laggards: sorted.slice(-2).reverse().map((m) => m.name),
    };
  }

  const supportiveSleeves = Object.values(sleeves).filter((s) =>
    ["supportive", "mild_supportive"].includes(s.state)
  );
  const defensiveSleeves = Object.values(sleeves).filter((s) =>
    ["defensive", "mild_defensive"].includes(s.state)
  );

  let tapeQuality: Interpretation["tapeQuality"] = "mixed";

  if (supportiveSleeves.length >= 4) {
    tapeQuality = "broad_supportive";
  } else if (
    supportiveSleeves.length >= 2 &&
    sleeves.equities.score > 0.35 &&
    sleeves.fxCarry.score > 0
  ) {
    tapeQuality = "narrow_supportive";
  } else if (
    defensiveSleeves.length >= 4
  ) {
    tapeQuality = "broad_defensive";
  } else if (
    defensiveSleeves.length >= 2 &&
    sleeves.equities.score < 0 &&
    sleeves.vol.score < 0
  ) {
    tapeQuality = "defensive_divergence";
  }

  let tradeTranslation = "Mixed tape. Stay selective until alignment improves.";
  const bestExpressions: string[] = [];
  const warningFlags: string[] = [];

  if (tapeQuality === "broad_supportive") {
    tradeTranslation =
      "Broad supportive tape. Favour selective pro-risk continuation rather than defensive expressions.";
  } else if (tapeQuality === "narrow_supportive") {
    tradeTranslation =
      "Constructive but not fully broad. Prefer selective pro-risk trades in the clearest leaders rather than chasing everything.";
  } else if (tapeQuality === "broad_defensive") {
    tradeTranslation =
      "Broad defensive tape. Lean away from high-beta continuation and favour defensive or protection-style setups.";
  } else if (tapeQuality === "defensive_divergence") {
    tradeTranslation =
      "Defensive divergence is present. Be careful with pro-risk chasing because the backdrop is not clean.";
  }

  const equitiesLeaders = sleeves.equities.leaders;
  const fxLeaders = sleeves.fxCarry.leaders;
  const commodityLeaders = sleeves.commodities.leaders;

  if (supportiveSleeves.length > defensiveSleeves.length) {
    bestExpressions.push(...fxLeaders.slice(0, 1));
    bestExpressions.push(...equitiesLeaders.slice(0, 2));
  } else if (defensiveSleeves.length > supportiveSleeves.length) {
    bestExpressions.push(...sleeves.vol.leaders.slice(0, 1));
    bestExpressions.push(...sleeves.rates.leaders.slice(0, 1));
    bestExpressions.push(...sleeves.commodities.leaders.filter((x) => x === "Gold"));
  } else {
    bestExpressions.push(...equitiesLeaders.slice(0, 1));
    bestExpressions.push(...fxLeaders.slice(0, 1));
  }

  if (sleeves.vol.state === "mixed") {
    warningFlags.push("Vol is not giving clean confirmation.");
  }
  if (["mild_defensive", "defensive"].includes(sleeves.rates.state)) {
    warningFlags.push("Rates / bonds still lean defensive.");
  }
  if (sleeves.commodities.state === "mixed") {
    warningFlags.push("Commodities are not fully aligned.");
  }
  if (supportiveSleeves.length > 0 && defensiveSleeves.length > 0) {
    warningFlags.push("Cross-asset confirmation is incomplete.");
  }

  return {
    sleeves,
    tapeQuality,
    tradeTranslation,
    bestExpressions: Array.from(new Set(bestExpressions)).filter(Boolean),
    warningFlags: Array.from(new Set(warningFlags)),
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const {
      data: snapshot,
      error: snapshotError,
    } = (await supabase
      .from("market_sentiment_intraday_snapshots")
      .select("*")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle()) as {
      data: SnapshotRow | null;
      error: Error | null;
    };

    if (snapshotError) throw snapshotError;

    if (!snapshot) {
      const empty: LatestResponse = {
        ok: true,
        snapshot: null,
        prices: [],
        history: [],
      };
      return NextResponse.json(empty);
    }

    const {
      data: history,
      error: historyError,
    } = (await supabase
      .from("market_sentiment_intraday_snapshots")
      .select("ts,score,regime,breadth")
      .order("ts", { ascending: false })
      .limit(24)) as {
      data: HistoryRow[] | null;
      error: Error | null;
    };

    if (historyError) throw historyError;

    const snapshotMs = Date.parse(snapshot.ts);
    const windowStart = new Date(snapshotMs - 36 * 60 * 60 * 1000).toISOString();

    const {
      data: recentPrices,
      error: pricesError,
    } = (await supabase
      .from("market_sentiment_intraday_prices")
      .select(
        [
          "ts",
          "asset_code",
          "asset_name",
          "asset_class",
          "price",
          "prev_15m_change_pct",
          "hour_change_pct",
          "rolling_2h_change_pct",
          "rolling_4h_change_pct",
          "previous_day_same_time_change_pct",
          "london_change_pct",
          "session_change_pct",
        ].join(",")
      )
      .gte("ts", windowStart)
      .lte("ts", snapshot.ts)
      .order("ts", { ascending: false })
      .limit(4000)) as {
      data: PriceRowRaw[] | null;
      error: Error | null;
    };

    if (pricesError) throw pricesError;

    const rows = recentPrices ?? [];
    const byAsset = new Map<string, PriceRowRaw[]>();

    for (const row of rows) {
      const existing = byAsset.get(row.asset_code);
      if (existing) {
        existing.push(row);
      } else {
        byAsset.set(row.asset_code, [row]);
      }
    }

    const prices: PriceRow[] = [];

    for (const [, assetRows] of byAsset.entries()) {
      const latest = assetRows[0];
      if (!latest) continue;
      prices.push(enrichLatestRow(latest, assetRows));
    }

    prices.sort((a, b) => a.asset_code.localeCompare(b.asset_code));

    const interpretation = buildInterpretation(prices, snapshot.components ?? {});

    const response: LatestResponse = {
      ok: true,
      snapshot,
      prices,
      history: (history ?? []).reverse(),
      interpretation,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}