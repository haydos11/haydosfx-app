"use client";

import { useEffect, useMemo, useState } from "react";

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
  summary_text: string;
};

type PriceRow = {
  asset_code: string;
  asset_name: string;
  london_change_pct: number | null;
  session_change_pct: number | null;
  hour_change_pct: number | null;
  prev_15m_change_pct: number | null;
};

type ApiResponse = {
  ok: boolean;
  snapshot?: Snapshot | null;
  prices?: PriceRow[];
  error?: string;
};

function fmtPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtNum(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
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

function countdownToNextQuarterHour(nowMs: number) {
  const intervalMs = 15 * 60 * 1000;
  const next = Math.ceil(nowMs / intervalMs) * intervalMs;
  const diff = Math.max(0, next - nowMs);

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function regimeClasses(regime: string | undefined) {
  switch (regime) {
    case "strong_risk_on":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20";
    case "mild_risk_on":
      return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20";
    case "strong_risk_off":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20";
    case "mild_risk_off":
      return "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20";
    default:
      return "bg-slate-500/10 text-slate-200 ring-1 ring-white/10";
  }
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

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Risk Sentiment</h2>
          <p className="mt-1 text-xs text-slate-400">
            Intraday regime monitor for cross-asset risk tone
          </p>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Next data window
          </div>
          <div className="mt-1 text-sm font-medium text-slate-200">{countdown}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-sm text-slate-400">Loading…</div>
      ) : !data?.ok || !data.snapshot ? (
        <div className="py-6 text-sm text-red-400">
          {data?.error ?? "No sentiment data yet"}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="rounded-xl border border-white/10 bg-zinc-800/60 p-3">
            <p className="text-sm leading-6 text-slate-200">
              {data.snapshot.summary_text}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-zinc-800 p-3">
              <div className="text-xs text-slate-400">Score</div>
              <div className="mt-1 text-base font-semibold text-white">
                {data.snapshot.score.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-zinc-800 p-3">
              <div className="text-xs text-slate-400">Breadth</div>
              <div className="mt-1 text-base font-semibold text-white">
                {(data.snapshot.breadth * 100).toFixed(0)}%
              </div>
            </div>

            <div className="rounded-xl bg-zinc-800 p-3">
              <div className="text-xs text-slate-400">Vs prior snapshot</div>
              <div className="mt-1 text-base font-semibold text-white">
                {fmtNum(data.snapshot.previous_score_change)}
              </div>
            </div>

            <div className="rounded-xl bg-zinc-800 p-3">
              <div className="text-xs text-slate-400">Since London open</div>
              <div className="mt-1 text-base font-semibold text-white">
                {fmtNum(data.snapshot.london_change_score)}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-800 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Asset</th>
                  <th className="px-3 py-2 text-right font-medium">15m</th>
                  <th className="px-3 py-2 text-right font-medium">1h</th>
                  <th className="px-3 py-2 text-right font-medium">London</th>
                  <th className="px-3 py-2 text-right font-medium">Session</th>
                </tr>
              </thead>
              <tbody>
                {(data.prices ?? []).map((row) => (
                  <tr key={row.asset_code} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-200">{row.asset_name}</td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {fmtPct(row.prev_15m_change_pct)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {fmtPct(row.hour_change_pct)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {fmtPct(row.london_change_pct)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {fmtPct(row.session_change_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}