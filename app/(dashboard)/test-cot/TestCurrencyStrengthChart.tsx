"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption, LineSeriesOption } from "echarts";
import SafeEChart from "@/components/charts/SafeEChart";

type Point = {
  date: string;
  values: Record<string, number | null>;
};

type ApiResp = {
  points?: Point[];
};

const CURRENCIES = [
  { key: "AUD", label: "AUD" },
  { key: "CAD", label: "CAD" },
  { key: "CHF", label: "CHF" },
  { key: "EUR", label: "EUR" },
  { key: "GBP", label: "GBP" },
  { key: "JPY", label: "JPY" },
  { key: "NZD", label: "NZD" },
];

const BILLION = 1e9;

function fmtBillions(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n) / BILLION;
  const dec = v < 100 ? 1 : 0;
  return `${sign}${v.toFixed(dec)}B`;
}

function fmtYYMM(d: string) {
  const [y, m] = d.split("-");
  return `${y.slice(2)}-${m}`;
}

function NoScrollChart({
  option,
  height,
  mergeKey,
}: {
  option: EChartsOption;
  height: number;
  mergeKey: string;
}) {
  return (
    <div
      className="touch-pan-y"
      style={{ height }}
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      <SafeEChart
        option={option}
        height={height}
        notMerge
        replaceMerge={["series"]}
        key={mergeKey}
      />
    </div>
  );
}

export default function TestCurrencyStrengthChart({
  range = "1y",
  height = 420,
}: {
  range?: string;
  height?: number;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showUSD, setShowUSD] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(
          `/api/cot/test-fx-strength?range=${encodeURIComponent(range)}&v=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error(await res.text());

        const json = (await res.json()) as ApiResp;
        if (!cancelled) {
          setPoints(Array.isArray(json.points) ? json.points : []);
        }
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof Error ? error.message : "Failed to load chart");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const option: EChartsOption = useMemo(() => {
    const dates = points.map((p) => p.date);
    const target = 10;
    const step = Math.max(1, Math.ceil(Math.max(dates.length, 1) / target));

    const series: LineSeriesOption[] = CURRENCIES.map(({ label }) => ({
      name: label,
      type: "line",
      showSymbol: false,
      smooth: true,
      connectNulls: true,
      lineStyle: { width: 2 },
      emphasis: { focus: "series" },
      data: points.map((p) => p.values[label] ?? null),
    }));

    if (showUSD) {
      const usdData = points.map((p) => {
        let sum = 0;
        let hasAny = false;

        for (const { label } of CURRENCIES) {
          const v = p.values[label];
          if (typeof v === "number") {
            sum += v;
            hasAny = true;
          }
        }

        return hasAny ? -sum : null;
      });

      series.push({
        id: "USD_inferred",
        name: "USD* (inferred)",
        type: "line",
        showSymbol: false,
        smooth: true,
        connectNulls: true,
        lineStyle: { width: 3 },
        emphasis: { focus: "series" },
        data: usdData,
        z: 10,
      });
    }

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove",
        valueFormatter: (v) =>
          typeof v === "number" ? `$${fmtBillions(v)}` : String(v),
        axisPointer: { type: "line" },
      },
      legend: { top: 0, textStyle: { color: "#e5e7eb" } },
      grid: { top: 32, left: 48, right: 24, bottom: 48, containLabel: true },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLabel: {
          color: "#cbd5e1",
          hideOverlap: true,
          formatter: (v: string, idx: number) => (idx % step === 0 ? fmtYYMM(v) : ""),
        },
        axisLine: { lineStyle: { color: "rgba(203,213,225,0.35)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "USD (billions)",
        nameTextStyle: { color: "#94a3b8", padding: [0, 0, 4, 0] },
        axisLabel: {
          color: "#cbd5e1",
          formatter: (val: number) => fmtBillions(val),
          margin: 6,
        },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.22)" } },
      },
      dataZoom: [
        {
          type: "inside",
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          moveOnMouseMove: false,
        },
        { type: "slider", show: false },
      ],
      series,
    };
  }, [points, showUSD]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 p-4 text-sm text-slate-400">
        Loading FX positioning strength…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-white/10 p-4 text-sm text-amber-400">
        {err}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-200">
          CoT FX Positioning Strength (Directional USD Exposure)
        </div>

        <label className="flex select-none items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-violet-600"
            checked={showUSD}
            onChange={(e) => setShowUSD(e.target.checked)}
          />
          Show USD* (inferred)
        </label>
      </div>

      <NoScrollChart
        option={option}
        height={height}
        mergeKey={`test-fx-strength-${showUSD ? "1" : "0"}-${range}`}
      />

      <div className="mt-2 text-xs text-slate-400">
        USD* is inferred as the opposite side of the G8 basket at each date:
        USD*(t) = −Σ(G8 directional exposures at t). Positive = net long USD;
        negative = net short USD.
      </div>
    </div>
  );
}