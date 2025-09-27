// app/(dashboard)/cot/[market]/components/CotCharts.tsx
"use client";
import React from "react";
import ReactECharts from "echarts-for-react";
import type { CotSeries } from "@/lib/cot/shape";

/** Wrapper that blocks wheel/touch events from reaching ECharts, but still lets the page scroll */
function NoScrollChart({
  option,
  height,
}: {
  option: echarts.EChartsOption;
  height: number;
}) {
  return (
    <div
      className="touch-pan-y"            // allow vertical page scrolling on touch
      style={{ height }}
      onWheelCapture={(e) => {
        // stop ECharts from receiving the wheel event
        e.stopPropagation();
        // don't preventDefault -> page scroll still works
      }}
      onTouchMoveCapture={(e) => {
        // likewise for touch move (mobile)
        e.stopPropagation();
      }}
    >
      <ReactECharts
        style={{ height: "100%" }}
        option={option}
        // safety: ensure option takes effect immediately without merging in any lurking dataZoom
        notMerge={true}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}

function kfmt(v: number): string {
  if (v === 0) return "0";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
  return `${sign}${abs}`;
}

/** Reusable axis + legend styling for dark UI */
function commonOpts({ compact }: { compact?: boolean }) {
  return {
    backgroundColor: "transparent",
    legend: {
      top: 4,
      textStyle: { color: "#e5e7eb" },
      inactiveColor: "#64748b",
    },
    grid: { left: 52, right: 18, top: 28, bottom: 40 },
    xAxis: {
      type: "category" as const,
      axisLabel: { hideOverlap: true, color: "#cbd5e1" },
      axisLine: { lineStyle: { color: "rgba(203,213,225,0.25)" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: compact
        ? { formatter: (v: number) => kfmt(v), color: "#cbd5e1" }
        : { color: "#cbd5e1" },
      axisLine: { lineStyle: { color: "rgba(203,213,225,0.25)" } },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
    },
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { lineStyle: { color: "rgba(226,232,240,0.35)" } },
      // keep hover tooltips; no scroll binding here
      triggerOn: "mousemove",
    },
    // keep charts static (no zoom/pan even if something merges options elsewhere)
    dataZoom: [
      {
        type: "inside",
        zoomOnMouseWheel: false,
        moveOnMouseWheel: false,
        moveOnMouseMove: false,
      },
      { type: "slider", show: false },
    ],
  } satisfies echarts.EChartsOption;
}

function NetPositioning({
  dates, large, small, comm, height, compact,
}: {
  dates: string[]; large: number[]; small: number[]; comm: number[];
  height: number; compact?: boolean;
}) {
  const base = commonOpts({ compact });
  const option: echarts.EChartsOption = {
    ...base,
    xAxis: { ...base.xAxis, data: dates },
    series: [
      { name: "Large Speculators", type: "bar", stack: "net", data: large },
      { name: "Small Traders",     type: "bar", stack: "net", data: small },
      { name: "Commercials",       type: "bar", stack: "net", data: comm  },
    ],
  };
  return <NoScrollChart option={option} height={height} />;
}

function LSRatios({
  dates, a, b, c, height, compact,
}: {
  dates: string[]; a: number[]; b: number[]; c: number[];
  height: number; compact?: boolean;
}) {
  const base = commonOpts({ compact });
  const option: echarts.EChartsOption = {
    ...base,
    xAxis: { ...base.xAxis, data: dates },
    series: [
      { name: "Large Specs",   type: "line", smooth: true, showSymbol: false, connectNulls: true, data: a },
      { name: "Small Traders", type: "line", smooth: true, showSymbol: false, connectNulls: true, data: b },
      { name: "Commercials",   type: "line", smooth: true, showSymbol: false, connectNulls: true, data: c },
    ],
  };
  return <NoScrollChart option={option} height={height} />;
}

function OpenInterest({
  dates, oi, height, compact,
}: {
  dates: string[]; oi: (number | null)[]; height: number; compact?: boolean;
}) {
  const base = commonOpts({ compact });
  const option: echarts.EChartsOption = {
    ...base,
    xAxis: { ...base.xAxis, data: dates },
    series: [
      { name: "Open Interest", type: "line", smooth: true, showSymbol: false, connectNulls: true, data: oi },
    ],
  };
  return <NoScrollChart option={option} height={height} />;
}

export default function CotCharts({
  series,
  height = 260,
  compact = true,
}: {
  series: CotSeries;
  height?: number;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="rounded-2xl border border-white/10 p-4">
        <div className="text-sm mb-3 opacity-80">Net Positioning</div>
        <NetPositioning
          dates={series.dates}
          large={series.large}
          small={series.small}
          comm={series.comm}
          height={height}
          compact={compact}
        />
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <div className="text-sm mb-3 opacity-80">L/S Ratio by Trader Type</div>
        <LSRatios
          dates={series.dates}
          a={series.ls_large}
          b={series.ls_small}
          c={series.ls_comm}
          height={height}
          compact={compact}
        />
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <div className="text-sm mb-3 opacity-80">Open Interest</div>
        <OpenInterest
          dates={series.dates}
          oi={series.open_interest}
          height={height}
          compact={compact}
        />
      </div>

      <div className="lg:col-span-3 text-xs text-slate-500 px-1 -mt-2">
        Axes shown in thousands (k) / millions (m) for readability.
      </div>
    </div>
  );
}
