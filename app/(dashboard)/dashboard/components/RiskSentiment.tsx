"use client";

import { useEffect, useMemo, useState } from "react";

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
  rolling_2h_change_pct?: number | null;
  rolling_4h_change_pct?: number | null;
  previous_day_same_time_change_pct?: number | null;
  london_change_pct: number | null;
  session_change_pct: number | null;
};

type HistoryRow = {
  ts: string;
  score: number;
  regime: string;
  breadth: number;
};

type ApiResponse = {
  ok: boolean;
  snapshot: Snapshot | null;
  prices: PriceRow[];
  history: HistoryRow[];
  error?: string;
};

function fmtPct(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function labelRegime(regime: string | undefined) {
  switch (regime) {
    case "strong_risk_on":
      return "Strong Risk On";
    case "mild_risk_on":
      return "Mild Risk On";
    case "strong_risk_off":
      return "Strong Risk Off";
    case "mild_risk_off":
      return "Mild Risk Off";
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

function countdownToNextQuarterHour(nowMs: number) {
  const intervalMs = 15 * 60 * 1000;
  const next = Math.ceil(nowMs / intervalMs) * intervalMs;
  const diff = Math.max(0, next - nowMs);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function assetTone(direction: "risk_on" | "risk_off" | "neutral") {
  if (direction === "risk_on") {
    return "border-emerald-500/25 bg-emerald-500/10";
  }
  if (direction === "risk_off") {
    return "border-rose-500/25 bg-rose-500/10";
  }
  return "border-white/10 bg-white/[0.03]";
}

function barTone(value: number) {
  if (value > 0) return "bg-emerald-400";
  if (value < 0) return "bg-rose-400";
  return "bg-slate-500";
}

function buildSparklinePath(values: number[], width: number, height: number) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function RiskSentiment() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

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

    load();

    const pollId = window.setInterval(load, 60_000);
    const timerId = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => {
      mounted = false;
      window.clearInterval(pollId);
      window.clearInterval(timerId);
    };
  }, []);

  const countdown = useMemo(() => countdownToNextQuarterHour(nowMs), [nowMs]);

  const driverRows = useMemo(() => {
    const components = data?.snapshot?.components ?? {};
    return Object.entries(components)
      .map(([code, comp]) => ({ code, ...comp }))
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }, [data?.snapshot?.components]);

  const topDrivers = driverRows.slice(0, 6);

  const sparkValues = useMemo(
    () => (data?.history ?? []).map((row) => row.score),
    [data?.history]
  );

  const sparkPath = useMemo(
    () => buildSparklinePath(sparkValues, 320, 72),
    [sparkValues]
  );

  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.96),rgba(10,12,18,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-white">
            Risk Sentiment
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Intraday cross-asset regime monitor
          </p>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Next data window
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {countdown}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-sm text-slate-400">Loading risk sentiment…</div>
      ) : !data?.ok || !data.snapshot ? (
        <div className="py-8 text-sm text-red-400">
          {data?.error ?? "No sentiment data yet"}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${regimeClasses(
                    data.snapshot.regime
                  )}`}
                >
                  {labelRegime(data.snapshot.regime)}
                </span>

                <span className="text-xs text-slate-400">
                  Updated {new Date(data.snapshot.ts).toLocaleString()}
                </span>
              </div>

              <p className="text-[15px] leading-7 text-slate-200">
                {data.snapshot.summary_text}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Score"
                  value={data.snapshot.score.toFixed(2)}
                  accent={data.snapshot.score >= 0 ? "positive" : "negative"}
                />
                <MetricCard
                  label="Breadth"
                  value={`${(data.snapshot.breadth * 100).toFixed(0)}%`}
                />
                <MetricCard
                  label="Vs prior"
                  value={fmtNum(data.snapshot.previous_score_change)}
                  accent={
                    (data.snapshot.previous_score_change ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <MetricCard
                  label="Since London"
                  value={fmtNum(data.snapshot.london_change_score)}
                  accent={
                    (data.snapshot.london_change_score ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <MetricCard
                  label="Session drift"
                  value={fmtNum(data.snapshot.session_change_score)}
                  accent={
                    (data.snapshot.session_change_score ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <MetricCard
                  label="Vs yesterday"
                  value={fmtNum(data.snapshot.previous_day_same_time_score_change)}
                  accent={
                    (data.snapshot.previous_day_same_time_score_change ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <MetricCard
                  label="2h drift"
                  value={fmtNum(data.snapshot.rolling_2h_score_change)}
                  accent={
                    (data.snapshot.rolling_2h_score_change ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                />
                <MetricCard
                  label="4h drift"
                  value={fmtNum(data.snapshot.rolling_4h_score_change)}
                  accent={
                    (data.snapshot.rolling_4h_score_change ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                />
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Score trend
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Last {(data.history ?? []).length} snapshots
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Confidence
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {(data.snapshot.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <svg
                  viewBox="0 0 320 72"
                  className="h-24 w-full"
                  preserveAspectRatio="none"
                >
                  <line x1="0" y1="36" x2="320" y2="36" className="stroke-white/10" />
                  {sparkPath ? (
                    <path
                      d={sparkPath}
                      fill="none"
                      className="stroke-sky-300"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>
              </div>

              <div className="mt-4 space-y-3">
                {topDrivers.map((driver) => (
                  <div
                    key={driver.code}
                    className={`rounded-2xl border p-3 ${assetTone(driver.direction)}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium text-white">
                        {driver.code}
                      </div>
                      <div className="text-xs text-slate-400">
                        {driver.direction === "risk_on"
                          ? "Supporting risk"
                          : driver.direction === "risk_off"
                          ? "Defensive"
                          : "Neutral"}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <MiniMetric label="15m" value={fmtPct(driver.latestChange)} />
                      <MiniMetric label="1h" value={fmtPct(driver.hourChange)} />
                      <MiniMetric label="London" value={fmtPct(driver.londonChange)} />
                      <MiniMetric label="Session" value={fmtPct(driver.sessionChange)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Cross-asset board
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Latest reading across all tracked sentiment instruments
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {data.prices.length} assets
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {data.prices.map((row) => {
                const component = data.snapshot?.components?.[row.asset_code];
                const direction = component?.direction ?? "neutral";
                const score = component?.score ?? 0;

                return (
                  <div
                    key={row.asset_code}
                    className={`rounded-[18px] border p-4 transition-colors ${assetTone(direction)}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">
                          {row.asset_name}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          {row.asset_code} · {row.asset_class}
                        </div>
                      </div>

                      <div className="min-w-[72px] text-right">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Driver score
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {fmtNum(score)}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${barTone(score)}`}
                        style={{
                          width: `${Math.min(100, Math.max(8, Math.abs(score) * 35))}%`,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <MiniMetric label="15m" value={fmtPct(row.prev_15m_change_pct)} />
                      <MiniMetric label="1h" value={fmtPct(row.hour_change_pct)} />
                      <MiniMetric label="2h" value={fmtPct(row.rolling_2h_change_pct)} />
                      <MiniMetric label="4h" value={fmtPct(row.rolling_4h_change_pct)} />
                      <MiniMetric label="London" value={fmtPct(row.london_change_pct)} />
                      <MiniMetric label="Session" value={fmtPct(row.session_change_pct)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: string;
  accent?: "neutral" | "positive" | "negative";
}) {
  const accentClass =
    accent === "positive"
      ? "text-emerald-300"
      : accent === "negative"
      ? "text-rose-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  const tone =
    value.startsWith("+")
      ? "text-emerald-300"
      : value.startsWith("-")
      ? "text-rose-300"
      : "text-slate-300";

  return (
    <div className="rounded-xl bg-black/20 px-2 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-sm font-medium ${tone}`}>{value}</div>
    </div>
  );
}