"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption, LineSeriesOption } from "echarts";
import SafeEChart from "@/components/charts/SafeEChart";

type Point = { date: string; netNotionalUSD: number | null };
type MarketResp = { points?: Point[] };
type SeriesMap = Record<string, Record<string, number | null>>; // date -> label -> value

const CURRENCIES = [
  { key: "aud", label: "AUD" },
  { key: "cad", label: "CAD" },
  { key: "chf", label: "CHF" },
  { key: "eur", label: "EUR" },
  { key: "gbp", label: "GBP" },
  { key: "jpy", label: "JPY" },
  { key: "nzd", label: "NZD" },
];

const BILLION = 1e9;
const fmtBillions = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n) / BILLION;
  const dec = v < 100 ? 1 : 0;
  return `${sign}${v.toFixed(dec)}B`;
};
const fmtYYMM = (d: string) => {
  const [y, m] = d.split("-");
  return `${y.slice(2)}-${m}`;
};

/* ---------------- Small client cache with lastGood ---------------- */
type Cached = { json: MarketResp; ts: number; lastGood?: MarketResp };
const respCache = new Map<string, Cached>();       // key: `${market}:${range}`
const lastGoodByMarket = new Map<string, MarketResp>(); // key: market (any range)
const inflight = new Map<string, Promise<MarketResp>>();

const TTL_MS = 60_000; // refresh window

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cutoffFor(range: string): string | null {
  const d = new Date();
  switch (range) {
    case "1y":
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      break;
    case "ytd":
      return new Date(new Date().getUTCFullYear(), 0, 1).toISOString().slice(0, 10);
    case "3y":
      d.setUTCFullYear(d.getUTCFullYear() - 3);
      break;
    case "5y":
      d.setUTCFullYear(d.getUTCFullYear() - 5);
      break;
    default:
      return null;
  }
  return d.toISOString().slice(0, 10);
}

function trimToRange(points: Point[], range: string): Point[] {
  const cut = cutoffFor(range);
  if (!cut) return points;
  return points.filter((p) => p.date >= cut);
}

async function fetchRange(market: string, range: string, cacheMode: RequestCache): Promise<MarketResp> {
  const url = `/api/cot/market/${market}?range=${encodeURIComponent(range)}&basis=usd`;
  const res = await fetch(url, { cache: cacheMode });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as MarketResp;
}

/** try requested range; on failure, try 3y -> 5y and trim back to requested window */
async function fetchRobust(market: string, range: string): Promise<MarketResp> {
  // prefer network on 1y, otherwise revalidate
  const plan: Array<{ r: string; mode: RequestCache }> =
    range === "1y"
      ? [
          { r: "1y", mode: "no-store" },
          { r: "3y", mode: "no-cache" },
          { r: "5y", mode: "no-cache" },
        ]
      : [{ r: range, mode: "no-cache" }];

  let lastErr: unknown;
  for (const step of plan) {
    try {
      const json = await fetchRange(market, step.r, step.mode);
      const normalized: MarketResp = json.points
        ? { points: trimToRange(json.points, range) }
        : { points: [] };
      // remember last good for this market (any range)
      lastGoodByMarket.set(market, normalized);
      return normalized;
    } catch (e) {
      lastErr = e;
      await sleep(150 + Math.floor(Math.random() * 150));
    }
  }

  // if all attempts failed, use last good (any previous range) if present
  const lg = lastGoodByMarket.get(market);
  if (lg) {
    return { points: trimToRange(lg.points ?? [], range) };
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

async function fetchWithCache(market: string, range: string): Promise<MarketResp> {
  const key = `${market}:${range}`;
  const c = respCache.get(key);
  const now = Date.now();
  if (c && now - c.ts < TTL_MS) return c.json;

  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const json = await fetchRobust(market, range);
      respCache.set(key, { json, ts: Date.now(), lastGood: json });
      return json;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** forward-fill each currency so the last row is fully populated */
function forwardFill(byDate: SeriesMap): SeriesMap {
  const dates = Object.keys(byDate).sort();
  if (!dates.length) return byDate;
  const labels = Object.keys(byDate[dates[0]] ?? {});
  const lastSeen: Record<string, number | null> = {};
  for (const l of labels) lastSeen[l] = null;

  for (const d of dates) {
    const row = byDate[d] ?? {};
    for (const l of labels) {
      const v = row[l];
      if (typeof v === "number") lastSeen[l] = v;
      else if (lastSeen[l] != null) row[l] = lastSeen[l];
    }
  }
  return byDate;
}

/** Wrapper that prevents the chart from capturing wheel/touch, so the page scrolls instead */
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
      {/* Force series replacement + remount on toggle */}
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

export default function CurrencyStrengthChart({
  range = "1y",
  height = 420,
}: {
  range?: string;
  height?: number;
}) {
  const [data, setData] = useState<SeriesMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [showUSD, setShowUSD] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      setWarn(null);

      const results: Array<{ label: string; points: Point[]; ok: boolean }> = [];

      // fetch serially (gentle on upstream)
      for (const c of CURRENCIES) {
        try {
          const json = await fetchWithCache(c.key, range);
          results.push({ label: c.label, ok: true, points: json.points ?? [] });
        } catch {
          results.push({ label: c.label, ok: false, points: [] });
        }
      }

      if (cancelled) return;

      if (results.every((r) => !r.ok || (r.points?.length ?? 0) === 0)) {
        setErr("Data temporarily unavailable.");
        setLoading(false);
        return;
      }

      // union of dates across currencies
      const dateSet = new Set<string>();
      for (const r of results) for (const p of r.points) if (p?.date) dateSet.add(p.date);
      const allDates = Array.from(dateSet).sort();

      // build byDate
      const byDate: SeriesMap = {};
      for (const d of allDates) byDate[d] = {};

      for (const { label, points } of results) {
        for (const p of points) {
          if (!p?.date) continue;
          const v =
            typeof p.netNotionalUSD === "number" && Number.isFinite(p.netNotionalUSD)
              ? p.netNotionalUSD
              : null;
          byDate[p.date][label] = v;
        }
      }

      // ensure all labels exist per date
      const labels = CURRENCIES.map((c) => c.label);
      for (const d of allDates) for (const l of labels) if (!(l in byDate[d])) byDate[d][l] = null;

      const filled = forwardFill(byDate);

      // warning if any currency had to use fallback/empty
      const empties = results.filter((r) => (r.points?.length ?? 0) === 0).map((r) => r.label);
      if (empties.length) setWarn(`Using cached/older data for: ${empties.join(", ")}`);

      setData(filled);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const option: EChartsOption = useMemo(() => {
    if (!data) return { series: [] };

    const dates = Object.keys(data).sort();
    const target = 10;
    const step = Math.max(1, Math.ceil(dates.length / target));

    const series: LineSeriesOption[] = CURRENCIES.map(({ label }) => ({
      name: label,
      type: "line",
      showSymbol: false,
      smooth: true,
      connectNulls: true,
      lineStyle: { width: 2 },
      emphasis: { focus: "series" },
      data: dates.map((d) => data[d]?.[label] ?? null),
    }));

    if (showUSD) {
      const usdData = dates.map((d) => {
        const row = data[d];
        let sum = 0;
        let hasAny = false;
        for (const { label } of CURRENCIES) {
          const v = row?.[label];
          if (typeof v === "number") {
            sum += v;
            hasAny = true;
          }
        }
        return hasAny ? -sum : null;
      });
      const usdSeries: LineSeriesOption = {
        id: "USD_inferred", // <-- stable id so echarts can remove it on replaceMerge
        name: "USD* (inferred)",
        type: "line",
        showSymbol: false,
        smooth: true,
        connectNulls: true,
        lineStyle: { width: 3 },
        emphasis: { focus: "series" },
        data: usdData,
        z: 10,
      };
      series.push(usdSeries);
    }

    const allEmpty = series.every((s) => (s.data as (number | null)[]).every((v) => v == null));
    if (allEmpty) {
      const emptyOption: EChartsOption = {
        backgroundColor: "transparent",
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "No data parsed for the selected range.",
            fill: "rgba(226,232,240,0.9)",
            fontSize: 14,
          },
        },
      };
      return emptyOption;
    }

    const chartOption: EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove",
        valueFormatter: (v) => (typeof v === "number" ? `$${fmtBillions(v)}` : String(v)),
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
          rotate: 0,
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
        axisLabel: { color: "#cbd5e1", formatter: (val: number) => fmtBillions(val), margin: 6 },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.22)" } },
      },
      dataZoom: [
        { type: "inside", zoomOnMouseWheel: false, moveOnMouseWheel: false, moveOnMouseMove: false },
        { type: "slider", show: false },
      ],
      series,
    };
    return chartOption;
  }, [data, showUSD]);

  if (loading) return <div className="text-sm text-slate-400">Loading currency strength…</div>;
  if (err) return <div className="text-sm text-amber-400">{err}</div>;
  if (!data) return null;

  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-200">
          CoT Currency Strength (Net Positioning in USD Notional)
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

      {warn ? <div className="mb-2 text-xs text-amber-400">{warn}</div> : null}

      <NoScrollChart
        option={option}
        height={height}
        mergeKey={`cs-${showUSD ? "1" : "0"}`} // remount on toggle (extra safety)
      />

      <div className="mt-2 text-xs text-slate-400">
        USD* is inferred as the opposite side of the G8 basket at each date: USD*(t) = −Σ(G8 USD notionals at t).
        Positive = net long USD; negative = net short USD.
      </div>
    </div>
  );
}
