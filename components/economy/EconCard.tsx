// components/economy/EconCard.tsx
"use client";

import SafeEChart from "@/components/charts/SafeEChart";
import type { EChartsOption, LineSeriesOption } from "echarts";

type Point = { date: string; value: number };

function axisKM(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return (v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "m";
  if (a >= 1_000) return (v / 1_000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(v);
}

function avgLast(values: Point[], n: number): number | null {
  const arr = values.filter((p) => Number.isFinite(p.value));
  if (arr.length < n) return null;
  const slice = arr.slice(-n);
  const sum = slice.reduce((acc, p) => acc + p.value, 0);
  return sum / n;
}

function buildTrend(points: Point[], units: "level" | "pct") {
  const a3 = avgLast(points, 3);
  const a6 = avgLast(points, 6);
  if (a3 == null || a6 == null) return null;

  const symbol = a3 > a6 ? "▲" : a3 < a6 ? "▼" : "→";
  const colorClass = a3 > a6 ? "text-emerald-400" : a3 < a6 ? "text-rose-400" : "text-slate-300";

  const fmt = (x: number) =>
    units === "pct" ? `${x.toFixed(2)}%` : x.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return { symbol, colorClass, a3Text: fmt(a3), a6Text: fmt(a6) };
}

function formatLatestDate(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Props = {
  title: string;
  latest: number | null;
  latestDate?: string | null;
  units?: "level" | "pct";
  decimals?: number;
  points: Point[];
  height?: number;
  showTrend?: boolean;
};

export function EconCard({
  title,
  latest,
  latestDate = null,
  units = "level",
  decimals = 2,
  points,
  height = 180,
  showTrend = false,
}: Props) {
  const fmtLatest = (v: number | null) =>
    v == null || !Number.isFinite(v)
      ? "—"
      : units === "pct"
      ? `${v.toFixed(decimals)}%`
      : v.toLocaleString(undefined, { maximumFractionDigits: decimals });

  const axisColor = "rgba(255,255,255,0.18)";
  const gridColor = "rgba(255,255,255,0.04)";
  const labelColor = "rgba(255,255,255,0.55)";

  const trend = buildTrend(points, units);
  const latestDateText = formatLatestDate(latestDate);

  const series: LineSeriesOption = {
    type: "line",
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2 },
    areaStyle: { opacity: 0.06 },
    data: points.map<[string, number]>((p) => [p.date, p.value]),
  };

  const option: EChartsOption = {
    animation: false,
    grid: { left: 44, right: 12, top: 18, bottom: 32 },
    xAxis: {
      type: "time",
      boundaryGap: [0, 0] as const,
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
      axisLabel: { color: labelColor, fontSize: 11, hideOverlap: true },
      splitLine: { show: true, lineStyle: { color: gridColor } },
      splitNumber: 4,
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
      axisLabel: {
        color: labelColor,
        fontSize: 11,
        formatter: (val: number) => (units === "pct" ? `${val.toFixed(0)}%` : axisKM(val)),
      },
      splitLine: { show: true, lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      valueFormatter: (val) =>
        units === "pct"
          ? `${Number(val).toFixed(decimals)}%`
          : Number(val).toLocaleString(undefined, { maximumFractionDigits: decimals }),
    },
    series: [series],
  };

  return (
    <div className="rounded-xl border border-white/5 bg-black/40 p-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="text-sm text-slate-200">{title}</div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-semibold">{fmtLatest(latest)}</div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Latest</span>
          </div>

          {latestDateText && (
            <div className="text-[11px] text-slate-400">
              {latestDateText}
            </div>
          )}
        </div>
      </div>

      {showTrend && trend && (
        <div className="mb-1 text-[11px] text-slate-400">
          ROC 3m vs 6m:&nbsp;
          <span className={trend.colorClass}>
            {trend.symbol} {trend.a3Text}/{trend.a6Text}
          </span>
        </div>
      )}

      <SafeEChart height={height} option={option} />
    </div>
  );
}