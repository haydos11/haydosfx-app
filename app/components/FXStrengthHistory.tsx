"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

type HistoryApi = {
  updated: string;
  days: number;
  dates: string[]; // x-axis labels (YYYY-MM-DD)
  ccys: string[];  // currency codes in legend order
  series: Record<string, (number | null)[]>;
};

const MAJORS = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"];

// Exponentially-Weighted Moving Average
function ewma(values: (number | null)[], alpha: number): (number | null)[] {
  if (!alpha || alpha <= 0) return values;
  let s: number | null = null;
  return values.map((v) => {
    if (v == null || !Number.isFinite(v)) return s; // carry last smoothed value
    s = s == null ? v : alpha * v + (1 - alpha) * s;
    return s;
  });
}

export default function FXStrengthHistory() {
  const [days, setDays] = useState<30 | 60>(30);
  const [smooth, setSmooth] = useState<number>(0.2); // 0 = raw, 1 = max smoothing
  const [data, setData] = useState<HistoryApi | null>(null);
  const [selected, setSelected] = useState<string[]>(MAJORS);
  const [err, setErr] = useState<string | null>(null);

  // Fetch 30/60 day history
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/fx-strength/history?days=${days}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`API ${res.status}: ${txt}`);
        }
        const json: HistoryApi = await res.json();
        if (!alive) return;
        setData(json);
        setSelected((sel) => sel.filter((c) => json.ccys.includes(c)));
        setErr(null);
      } catch (e: unknown) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [days]);

  // Build ECharts option
  const option = useMemo<echarts.EChartsOption>(() => {
    if (!data) {
      return { xAxis: {}, yAxis: {}, series: [] } as echarts.EChartsOption;
    }

    const palette = [
      "#60a5fa", "#a78bfa", "#34d399", "#f472b6",
      "#f59e0b", "#22d3ee", "#fb7185", "#c084fc",
      "#f97316", "#10b981", "#06b6d4", "#94a3b8",
    ];

    const visible = selected.length ? selected : data.ccys;

    const series: echarts.LineSeriesOption[] = visible.map((ccy, idx) => {
  const raw = data.series[ccy] ?? [];
  const alpha = 1 - smooth;
  const dat = smooth > 0 ? ewma(raw, alpha) : raw;
  return {
    name: ccy,
    type: "line" as const,
    smooth: true,
    showSymbol: false,
    data: dat,
    emphasis: { focus: "series" as const },
    lineStyle: { width: 2 },
    z: 2,
    endLabel: {
      show: true,
      formatter: () => ccy, // show currency code
      fontSize: 11,
      color: "inherit",     // match the line color automatically
    },
    labelLayout: {
      moveOverlap: "shiftY", // prevent overlapping labels
    },
  };
});


    return {
      color: palette,
      grid: { left: 40, right: 20, top: 60, bottom: 40 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) =>
          v == null ? "" : Number(v as number).toFixed(2),
      },
      legend: { show: false },
      xAxis: {
        type: "category" as const,
        data: data.dates,
        axisLabel: { formatter: (v: string) => v.slice(5) }, // show MM-DD
      },
      yAxis: {
        type: "value" as const,
        name: "z-score",
        splitLine: { lineStyle: { opacity: 0.25 } },
      },
      series,
    } as echarts.EChartsOption;
  }, [data, selected, smooth]);

  const toggle = (ccy: string) =>
    setSelected((sel) =>
      sel.includes(ccy) ? sel.filter((c) => c !== ccy) : [...sel, ccy]
    );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-semibold">Currency Strength Chart</h2>
          <p className="text-sm text-neutral-400">
            Compare relative strength over the last{" "}
            <strong>{days} days</strong>. Each line is the daily z-score of
            strength.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 rounded-full text-sm ${
              days === 30 ? "bg-white/20" : "bg-white/10"
            } hover:bg-white/20`}
            onClick={() => setDays(30)}
          >
            30d
          </button>
          <button
            className={`px-3 py-1 rounded-full text-sm ${
              days === 60 ? "bg-white/20" : "bg-white/10"
            } hover:bg-white/20`}
            onClick={() => setDays(60)}
          >
            60d
          </button>

          {/* Smoothing control */}
          <div className="ml-3 flex items-center gap-2">
            <label className="text-xs text-neutral-400 whitespace-nowrap">
              Smoothing
            </label>
            <span className="text-xs text-neutral-500">raw</span>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.05}
              value={smooth}
              onChange={(e) => setSmooth(Number(e.target.value))}
              className="w-40 accent-purple-400"
              title="Smoothing (0 = raw, 1 = max)"
            />
            <span className="text-xs text-neutral-500">max</span>
            <span className="text-xs tabular-nums text-neutral-300">
              {smooth.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap gap-2 mb-3">
          {data.ccys.map((c) => (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`px-3 py-1 rounded-full border text-sm ${
                selected.includes(c)
                  ? "border-white/50 bg-white/10"
                  : "border-white/20 bg-transparent text-neutral-300"
              }`}
              title={selected.includes(c) ? "Hide" : "Show"}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {err && <div className="text-rose-400 text-sm mb-2">{err}</div>}

      <div className="h-[360px]">
        <ReactECharts option={option} style={{ width: "100%", height: "100%" }} />
      </div>

      <p className="text-xs text-neutral-500 mt-2">
        {data ? `As of ${new Date(data.updated).toLocaleString()}` : ""}
      </p>

      <p className="text-xs text-neutral-500 mt-1">
        EWMA α = {(1 - smooth).toFixed(2)} &nbsp; (0 = raw, 1 = max smoothing)
      </p>
    </div>
  );
}
