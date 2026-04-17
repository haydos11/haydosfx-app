"use client";

import RiskSentimentGauge from "./RiskSentimentGauge";
import { useEffect, useMemo, useState } from "react";
import AnalyzeRiskSentimentButton, {
  type RiskSentimentAnalysisInput,
} from "./AnalyzeRiskSentimentButton";

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

type Snapshot = {
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

type PriceRow = {
  ts: string;
  asset_code: string;
  asset_name: string;
  asset_class: string;
  price: number;
  prev_15m_change_pct: number | null;
  hour_change_pct: number | null;
  daily_change_pct?: number | null;
  asia_change_pct?: number | null;
  rolling_2h_change_pct?: number | null;
  rolling_4h_change_pct?: number | null;
  previous_day_same_time_change_pct?: number | null;
  london_change_pct: number | null;
  newyork_change_pct?: number | null;
  session_change_pct: number | null;
};

type HistoryRow = {
  ts: string;
  score: number;
  regime: string;
  breadth: number;
};

type SleeveKey =
  | "equities"
  | "fxCarry"
  | "currencyFlows"
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

type SleeveHealth = {
  key: SleeveKey;
  label: string;
  state: "healthy" | "partial" | "unavailable";
  note: string;
};

type Diagnostics = {
  feedIssues: string[];
  marketCautions: string[];
  sleeveHealth: Record<SleeveKey, SleeveHealth>;
};

type SessionSummary = {
  activeSession: "asia" | "london" | "newyork";
  scores: {
    asia: number | null;
    london: number | null;
    newyork: number | null;
    day: number | null;
  };
  labels: {
    asia: string;
    london: string;
    newyork: string;
    day: string;
  };
};

type CurrencyFlowSummary = {
  byCurrency: Record<string, number>;
  betaScore: number;
  defensiveReleaseScore: number;
  usdScore: number;
  overallScore: number;
  leaders: string[];
  laggards: string[];
  betaLabel: "supportive" | "mixed" | "defensive";
  defensiveLabel: "released" | "mixed" | "firm";
  usdLabel: "soft" | "neutral" | "firm";
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
  sessionSummary: SessionSummary;
  currencyFlowSummary: CurrencyFlowSummary | null;
  diagnostics: Diagnostics;
};

type ApiResponse = {
  ok: boolean;
  snapshot: Snapshot | null;
  prices: PriceRow[];
  history: HistoryRow[];
  interpretation?: Interpretation | null;
  error?: string;
};

type LadderRow = {
  code: string;
  name: string;
  shortClass: string;
  assetClass: string;
  score: number;
  normalized: number;
  direction: "risk_on" | "risk_off" | "neutral";
  lastPrice: number | null;
  hour: number | null;
  daily: number | null;
  asia: number | null;
  london: number | null;
  newyork: number | null;
  session: number | null;
};

function fmtPct(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function fmtPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";

  const abs = Math.abs(value);

  if (abs >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  if (abs >= 100) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (abs >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 5,
  });
}

function countdownToNextQuarterHour(nowMs: number) {
  if (!nowMs) return "—";
  const intervalMs = 15 * 60 * 1000;
  const next = Math.ceil(nowMs / intervalMs) * intervalMs;
  const diff = Math.max(0, next - nowMs);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function labelRegime(regime: string | undefined) {
  switch (regime) {
    case "strong_risk_on":
      return "Strong Risk On";
    case "mild_risk_on":
      return "Risk On";
    case "strong_risk_off":
      return "Strong Risk Off";
    case "mild_risk_off":
      return "Risk Off";
    default:
      return "Mixed";
  }
}

function regimeClasses(regime: string | undefined) {
  switch (regime) {
    case "strong_risk_on":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25";
    case "mild_risk_on":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20";
    case "strong_risk_off":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25";
    case "mild_risk_off":
      return "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20";
    default:
      return "bg-slate-500/10 text-slate-200 ring-1 ring-white/10";
  }
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.4) return "Medium";
  return "Low";
}

function readableAssetName(code: string, assetName: string) {
  const map: Record<string, string> = {
    AUDJPY: "AUDJPY",
    EURCHF: "EURCHF",
    USDJPY: "USDJPY",
    SPY: "SPX500",
    QQQ: "NAS100",
    VIX: "VIX",
    TLT: "Long Bonds",
    COPPER: "Copper",
    XAUUSD: "Gold",
    WTI: "WTI",
    US10Y: "US 10Y",
    US2Y: "US 2Y",
    JP225: "JPN225",
    GER40: "GER40",
    FRA40: "FRA40",
  };

  return map[code] ?? assetName;
}

function shortClass(assetClass: string) {
  switch (assetClass) {
    case "equity":
      return "Equity";
    case "fx":
      return "FX";
    case "bond":
      return "Bond";
    case "rates":
      return "Rates";
    case "commodity":
      return "Commodity";
    case "volatility":
      return "Vol";
    default:
      return assetClass;
  }
}

function summarizeMove(snapshot: Snapshot) {
  const regime = labelRegime(snapshot.regime);
  const state = snapshot.improving
    ? "improving"
    : snapshot.degrading
      ? "softening"
      : "holding steady";

  return `${regime} tone, currently ${state}.`;
}

function buildMeaning(snapshot: Snapshot) {
  const breadthPct = Math.round(snapshot.breadth * 100);

  if (snapshot.regime === "strong_risk_on" || snapshot.regime === "mild_risk_on") {
    return `Markets are leaning pro-risk. Breadth is ${breadthPct}%, so the tone is constructive, but it still needs broader follow-through to stay clean.`;
  }

  if (snapshot.regime === "strong_risk_off" || snapshot.regime === "mild_risk_off") {
    return `Markets are leaning defensive. Breadth is ${breadthPct}%, so safer assets have a better backdrop unless risk markets reassert themselves.`;
  }

  return `Cross-asset signals are mixed. Some assets support appetite while others push back, so this is not yet a clean one-way regime.`;
}

function buildLadderRows(
  prices: PriceRow[],
  components: Record<string, SnapshotComponent>
): LadderRow[] {
  const rows = prices.map((row) => {
    const component = components[row.asset_code];
    const score = component?.score ?? 0;
    const normalized = Math.max(0, Math.min(100, 50 + score * 18));

    return {
      code: row.asset_code,
      name: readableAssetName(row.asset_code, row.asset_name),
      shortClass: shortClass(row.asset_class),
      assetClass: row.asset_class,
      score,
      normalized,
      direction: component?.direction ?? "neutral",
      lastPrice: row.price ?? null,
      hour: row.hour_change_pct,
      daily: row.daily_change_pct ?? null,
      asia: row.asia_change_pct ?? null,
      london: row.london_change_pct ?? null,
      newyork: row.newyork_change_pct ?? null,
      session: row.session_change_pct,
    };
  });

  return rows.sort((a, b) => b.normalized - a.normalized);
}

function dotTone(direction: "risk_on" | "risk_off" | "neutral") {
  if (direction === "risk_on") return "bg-emerald-300 border-emerald-200";
  if (direction === "risk_off") return "bg-rose-300 border-rose-200";
  return "bg-slate-300 border-slate-200";
}

function boxTone(value: string) {
  if (value.startsWith("+")) return "text-emerald-300";
  if (value.startsWith("-")) return "text-rose-300";
  return "text-slate-300";
}

function sessionTone(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "text-slate-400";
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-slate-300";
}

function labelSleeveState(value: SleeveSummary["state"]) {
  return value.replaceAll("_", " ");
}

function labelTapeQuality(value: Interpretation["tapeQuality"] | undefined) {
  switch (value) {
    case "broad_supportive":
      return "Broad Supportive";
    case "narrow_supportive":
      return "Narrow Supportive";
    case "defensive_divergence":
      return "Defensive Divergence";
    case "broad_defensive":
      return "Broad Defensive";
    default:
      return "Mixed";
  }
}

function labelSessionName(value: "asia" | "london" | "newyork") {
  switch (value) {
    case "asia":
      return "Asia";
    case "london":
      return "London";
    case "newyork":
      return "New York";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildVisualRiskScore(snapshot: Snapshot) {
  return Math.round(clamp(50 + (snapshot.score ?? 0) * 18, 0, 100));
}

export default function RiskSentimentLab() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch("/api/market-sentiment/latest", {
          cache: "no-store",
        });
        const json: ApiResponse = await res.json();
        if (mounted) setData(json);
      } catch {
        if (mounted) {
          setData({
            ok: false,
            snapshot: null,
            prices: [],
            history: [],
            error: "Failed to load risk sentiment",
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    setNowMs(Date.now());
    void load();

    const pollId = window.setInterval(load, 60_000);
    const timerId = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => {
      mounted = false;
      window.clearInterval(pollId);
      window.clearInterval(timerId);
    };
  }, []);

  const countdown = useMemo(() => countdownToNextQuarterHour(nowMs), [nowMs]);

  const ladderRows = useMemo(() => {
    return buildLadderRows(data?.prices ?? [], data?.snapshot?.components ?? {});
  }, [data?.prices, data?.snapshot?.components]);

  const interpretation = data?.interpretation ?? null;
  const activeSession = interpretation?.sessionSummary?.activeSession ?? "london";

  const visualScore = useMemo(() => {
    if (!data?.snapshot) return 50;
    return buildVisualRiskScore(data.snapshot);
  }, [data?.snapshot]);

  const topSupportive = useMemo(
    () =>
      ladderRows
        .filter((r) => r.direction === "risk_on")
        .slice(0, 3)
        .map((r) => r.name),
    [ladderRows]
  );

  const topDefensive = useMemo(
    () =>
      ladderRows
        .filter((r) => r.direction === "risk_off")
        .slice(0, 3)
        .map((r) => r.name),
    [ladderRows]
  );

  const aiInput = useMemo<RiskSentimentAnalysisInput | null>(() => {
    if (!data?.snapshot) return null;

    return {
      regime: data.snapshot.regime,
      score: data.snapshot.score ?? null,
      confidence: data.snapshot.confidence ?? null,
      breadth: data.snapshot.breadth ?? null,
      improving: data.snapshot.improving ?? null,
      degrading: data.snapshot.degrading ?? null,
      previousScoreChange: data.snapshot.previous_score_change ?? null,
      londonChangeScore: data.snapshot.london_change_score ?? null,
      sessionChangeScore: data.snapshot.session_change_score ?? null,
      previousDaySameTimeScoreChange:
        data.snapshot.previous_day_same_time_score_change ?? null,
      rolling2hScoreChange: data.snapshot.rolling_2h_score_change ?? null,
      rolling4hScoreChange: data.snapshot.rolling_4h_score_change ?? null,
      updatedAt: data.snapshot.ts ?? null,
      summaryText: data.snapshot.summary_text ?? null,
      topSupportive,
      topDefensive,
      sleeves: interpretation?.sleeves ?? null,
      diagnostics: interpretation?.diagnostics ?? null,
      sessionSummary: interpretation?.sessionSummary ?? null,
      currencyFlowSummary: interpretation?.currencyFlowSummary ?? null,
      tapeQuality: interpretation?.tapeQuality ?? null,
      tradeTranslation: interpretation?.tradeTranslation ?? null,
      bestExpressions: interpretation?.bestExpressions ?? [],
      warningFlags: interpretation?.warningFlags ?? [],
      ladderRows: ladderRows.map((row) => ({
        code: row.code,
        name: row.name,
        assetClass: row.assetClass,
        direction: row.direction,
        score: row.score ?? null,
        normalized: row.normalized ?? null,
        lastPrice: row.lastPrice ?? null,
        latest: null,
        hour: row.hour ?? null,
        daily: row.daily ?? null,
        asia: row.asia ?? null,
        london: row.london ?? null,
        newyork: row.newyork ?? null,
        session: row.session ?? null,
      })),
    };
  }, [data?.snapshot, interpretation, ladderRows, topSupportive, topDefensive]);

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,28,0.98),rgba(10,12,18,0.98))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-white">
            Risk Sentiment
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Cross-asset sleeves, sleeve health, currency flows, session flows,
            and ladder detail
          </p>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Next data window
          </div>
          <div className="mt-0.5 text-[18px] font-semibold text-slate-100">
            {countdown}
          </div>

          {aiInput ? (
            <div className="mt-2 flex justify-end">
              <AnalyzeRiskSentimentButton input={aiInput} compact />
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-sm text-slate-400">Loading risk sentiment…</div>
      ) : !data?.ok || !data?.snapshot ? (
        <div className="py-8 text-sm text-red-400">
          {data?.error ?? "No sentiment data yet"}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-4">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${regimeClasses(
                      data.snapshot.regime
                    )}`}
                  >
                    {labelRegime(data.snapshot.regime)}
                  </span>

                  <span className="text-[11px] text-slate-400">
                    Updated {new Date(data.snapshot.ts).toLocaleString()}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300">
                    Confidence: {confidenceLabel(data.snapshot.confidence)}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Risk state
                  </div>

                  <RiskSentimentGauge score={visualScore} />

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-[17px] font-semibold text-white">
                      {summarizeMove(data.snapshot)}
                    </p>
                    <p className="mt-2.5 text-sm leading-7 text-slate-300">
                      {buildMeaning(data.snapshot)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <SignalBox
                    label="Tape quality"
                    value={labelTapeQuality(interpretation?.tapeQuality)}
                    tone={
                      interpretation?.tapeQuality === "broad_supportive" ||
                      interpretation?.tapeQuality === "narrow_supportive"
                        ? "positive"
                        : interpretation?.tapeQuality === "broad_defensive" ||
                            interpretation?.tapeQuality ===
                              "defensive_divergence"
                          ? "negative"
                          : "neutral"
                    }
                  />
                  <SignalBox
                    label="Active session"
                    value={labelSessionName(activeSession)}
                    tone="neutral"
                  />
                  <SignalBox
                    label="Since last update"
                    value={fmtNum(data.snapshot.previous_score_change)}
                    tone={
                      (data.snapshot.previous_score_change ?? 0) >= 0
                        ? "positive"
                        : "negative"
                    }
                  />
                  <SignalBox
                    label="Breadth"
                    value={`${Math.round(data.snapshot.breadth * 100)}%`}
                    tone="neutral"
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Trade translation
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    {interpretation?.tradeTranslation ??
                      "Mixed tape. Best to stay selective until alignment improves."}
                  </p>
                </div>

                {interpretation?.currencyFlowSummary && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Currency flow read
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <SignalBox
                        label="Beta FX"
                        value={interpretation.currencyFlowSummary.betaLabel}
                        tone={
                          interpretation.currencyFlowSummary.betaLabel ===
                          "supportive"
                            ? "positive"
                            : interpretation.currencyFlowSummary.betaLabel ===
                                "defensive"
                              ? "negative"
                              : "neutral"
                        }
                      />
                      <SignalBox
                        label="JPY / CHF"
                        value={
                          interpretation.currencyFlowSummary.defensiveLabel
                        }
                        tone={
                          interpretation.currencyFlowSummary.defensiveLabel ===
                          "released"
                            ? "positive"
                            : interpretation.currencyFlowSummary
                                  .defensiveLabel === "firm"
                              ? "negative"
                              : "neutral"
                        }
                      />
                      <SignalBox
                        label="USD"
                        value={interpretation.currencyFlowSummary.usdLabel}
                        tone={
                          interpretation.currencyFlowSummary.usdLabel === "soft"
                            ? "positive"
                            : interpretation.currencyFlowSummary.usdLabel ===
                                "firm"
                              ? "negative"
                              : "neutral"
                        }
                      />
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      Leaders:{" "}
                      {interpretation.currencyFlowSummary.leaders.join(", ")} ·
                      {" "}Laggards:{" "}
                      {interpretation.currencyFlowSummary.laggards.join(", ")}
                    </div>
                  </div>
                )}

                <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                  <SummaryList
                    title="Best expressions"
                    tone="positive"
                    items={interpretation?.bestExpressions ?? topSupportive}
                  />
                  <SummaryList
                    title="Market cautions"
                    tone="negative"
                    items={interpretation?.diagnostics?.marketCautions ?? []}
                  />
                </div>

                {(interpretation?.diagnostics?.feedIssues?.length ?? 0) > 0 ? (
                  <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-amber-300">
                      Feed issues
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {interpretation?.diagnostics?.feedIssues.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[13px] text-white"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              {!!interpretation?.sessionSummary && (
                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Session read
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Explicit session flows instead of a single London-only
                      reference
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    <SessionCard
                      title="Asia"
                      label={interpretation.sessionSummary.labels.asia}
                      value={fmtPct(interpretation.sessionSummary.scores.asia)}
                    />
                    <SessionCard
                      title="London"
                      label={interpretation.sessionSummary.labels.london}
                      value={fmtPct(
                        interpretation.sessionSummary.scores.london
                      )}
                    />
                    <SessionCard
                      title="New York"
                      label={interpretation.sessionSummary.labels.newyork}
                      value={fmtPct(
                        interpretation.sessionSummary.scores.newyork
                      )}
                    />
                    <SessionCard
                      title="Day"
                      label={interpretation.sessionSummary.labels.day}
                      value={fmtPct(interpretation.sessionSummary.scores.day)}
                    />
                  </div>
                </div>
              )}

              {!!interpretation?.sleeves &&
                !!interpretation?.diagnostics?.sleeveHealth && (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          Sleeve health
                        </div>
                        <div className="mt-1 text-sm text-slate-300">
                          Signal state and data health shown separately
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                      {Object.values(interpretation.sleeves).map((sleeve) => (
                        <SleeveCard
                          key={sleeve.key}
                          sleeve={sleeve}
                          health={
                            interpretation.diagnostics.sleeveHealth[sleeve.key]
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Risk ladder
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Compact ladder with thinner strip and tighter stat boxes
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {ladderRows.length} assets
                  </div>
                </div>

                <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
                  <div className="grid grid-cols-[190px_minmax(0,1fr)] border-b border-white/10 bg-white/[0.03]">
                    <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Asset
                    </div>
                    <div className="px-4 py-2">
                      <div className="relative h-4">
                        <div className="absolute inset-y-0 left-0 w-[34%] rounded-full bg-rose-500/15" />
                        <div className="absolute inset-y-0 left-[34%] w-[32%] rounded-full bg-slate-500/10" />
                        <div className="absolute inset-y-0 right-0 w-[34%] rounded-full bg-emerald-500/15" />

                        <div className="absolute left-0 -top-[1px] text-[9px] uppercase tracking-[0.16em] text-rose-300">
                          Defensive
                        </div>
                        <div className="absolute left-1/2 -top-[1px] -translate-x-1/2 text-[9px] uppercase tracking-[0.16em] text-slate-400">
                          Neutral
                        </div>
                        <div className="absolute right-0 -top-[1px] text-[9px] uppercase tracking-[0.16em] text-emerald-300">
                          Supportive
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-white/5">
                    {ladderRows.map((row) => {
                      const activeSessionValue =
                        activeSession === "asia"
                          ? row.asia
                          : activeSession === "london"
                            ? row.london
                            : row.newyork;

                      return (
                        <div
                          key={row.code}
                          className="grid grid-cols-[190px_minmax(0,1fr)] items-center"
                        >
                          <div className="px-4 py-2.5">
                            <div className="truncate text-[13px] font-semibold leading-5 text-white">
                              {row.name}
                            </div>
                            <div className="truncate text-[10px] uppercase tracking-[0.16em] text-slate-500">
                              {row.code} · {row.shortClass}
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[11px] text-slate-400">
                                {fmtPrice(row.lastPrice)}
                              </span>
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  row.direction === "risk_on"
                                    ? "bg-emerald-300"
                                    : row.direction === "risk_off"
                                      ? "bg-rose-300"
                                      : "bg-slate-300"
                                }`}
                              />
                            </div>
                          </div>

                          <div className="min-w-0 px-4 py-2.5">
                            <div className="relative h-[16px] rounded-full border border-white/10 bg-[linear-gradient(90deg,rgba(244,63,94,0.13)_0%,rgba(100,116,139,0.08)_50%,rgba(16,185,129,0.13)_100%)]">
                              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10" />
                              <div
                                className={`absolute top-1/2 h-[13px] w-[13px] -translate-y-1/2 rounded-full border shadow-[0_0_18px_rgba(255,255,255,0.14)] ${dotTone(
                                  row.direction
                                )}`}
                                style={{
                                  left: `calc(${row.normalized}% - 6.5px)`,
                                }}
                              />
                            </div>

                            <div className="mt-2 grid min-w-0 grid-cols-3 gap-2">
                              <MiniValueInline
                                label="1H"
                                value={fmtPct(row.hour)}
                              />
                              <MiniValueInline
                                label={labelSessionName(activeSession)}
                                value={fmtPct(activeSessionValue)}
                              />
                              <MiniValueInline
                                label="Day"
                                value={fmtPct(row.daily)}
                              />
                            </div>

                            <div className="mt-1.5 flex justify-end">
                              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                Session:{" "}
                                <span
                                  className={`font-medium ${sessionTone(
                                    activeSessionValue
                                  )}`}
                                >
                                  {fmtPct(activeSessionValue)}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  <LegendPill
                    title="Defensive"
                    description="Assets leaning against appetite"
                    tone="negative"
                  />
                  <LegendPill
                    title="Neutral"
                    description="Little influence right now"
                    tone="neutral"
                  />
                  <LegendPill
                    title="Supportive"
                    description="Assets backing growth / beta"
                    tone="positive"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1.5 text-[15px] font-semibold ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function SummaryList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const wrapperClass =
    tone === "positive"
      ? "border-emerald-500/20 bg-emerald-500/8"
      : "border-rose-500/20 bg-rose-500/8";

  const titleClass =
    tone === "positive" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className={`rounded-2xl border p-3 ${wrapperClass}`}>
      <div className={`text-[10px] uppercase tracking-[0.16em] ${titleClass}`}>
        {title}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-sm text-slate-400">None notable</span>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[13px] text-white"
            >
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function MiniValueInline({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/5 bg-black/25 px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[8px] uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span className={`truncate text-[12px] font-medium ${boxTone(value)}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SleeveCard({
  sleeve,
  health,
}: {
  sleeve: SleeveSummary;
  health: SleeveHealth;
}) {
  const toneClass =
    sleeve.state === "supportive" || sleeve.state === "mild_supportive"
      ? "border-emerald-500/20 bg-emerald-500/8"
      : sleeve.state === "defensive" || sleeve.state === "mild_defensive"
        ? "border-rose-500/20 bg-rose-500/8"
        : "border-white/10 bg-white/[0.03]";

  const badgeTone =
    health.state === "healthy"
      ? "text-emerald-300"
      : health.state === "partial"
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
          {sleeve.label}
        </div>
        <span className={`text-[10px] uppercase tracking-[0.14em] ${badgeTone}`}>
          {health.state}
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-white">
        {labelSleeveState(sleeve.state)}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        Agreement {Math.round(sleeve.agreement * 100)}%
      </div>
      <div className="mt-2 text-xs text-slate-300">
        Leaders: {sleeve.leaders.join(", ") || "—"}
      </div>
      <div className="mt-2 text-[11px] leading-5 text-slate-400">
        {health.note}
      </div>
    </div>
  );
}

function SessionCard({
  title,
  label,
  value,
}: {
  title: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-xs text-slate-400">{value}</div>
    </div>
  );
}

function LegendPill({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
      : tone === "negative"
        ? "border-rose-500/20 bg-rose-500/8 text-rose-200"
        : "border-white/10 bg-white/[0.03] text-slate-200";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-slate-300">{description}</div>
    </div>
  );
}