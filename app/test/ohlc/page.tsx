"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Candle = { t: number; o: number | null; h: number | null; l: number | null; c: number | null; v: number | null };
type Meta = { currency?: string; exchangeName?: string; instrumentType?: string; gmtoffset?: number };
type Series = { symbol: string; ok: boolean; source: string; meta?: Meta; candles?: Candle[]; error?: string };
type ApiResp = { range: string; interval: string; count: number; results: Series[] };

const defaults = { symbols: "CNH,CNY", range: "6mo", interval: "1d" };

function fmtDate(ms: number) {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function isFlatOHLC(c: Candle) {
  if (c.o == null || c.h == null || c.l == null || c.c == null) return false;
  return c.o === c.h && c.o === c.l && c.o === c.c;
}

function mostlyFlat(s: Series) {
  const ks = (s.candles ?? []).filter(c => c.o != null && c.h != null && c.l != null && c.c != null);
  if (!ks.length) return false;
  const flat = ks.filter(isFlatOHLC).length;
  return flat / ks.length >= 0.6;
}

export default function OHLCProbePage() {
  const [symbols, setSymbols] = useState(defaults.symbols);
  const [range, setRange] = useState(defaults.range);
  const [interval, setInterval] = useState(defaults.interval);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("symbols", symbols);
    params.set("range", range);
    params.set("interval", interval);
    return `/api/ohlc?${params.toString()}`;
  }, [symbols, range, interval]);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(query, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResp;
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function candleOption(s: Series) {
    const rows = (s.candles ?? [])
      .filter((c) => c.o != null && c.h != null && c.l != null && c.c != null)
      .map((c) => ({ d: fmtDate(c.t), k: [c.o as number, c.c as number, c.l as number, c.h as number] }));
    const dates = rows.map((r) => r.d);
    const kdata = rows.map((r) => r.k);

    return {
      animation: false,
      grid: { left: 56, right: 24, top: 20, bottom: 40 },
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      xAxis: { type: "category", data: dates, boundaryGap: true, axisLabel: { hideOverlap: true } },
      yAxis: { scale: true },
      dataZoom: [
        { type: "inside", start: 70, end: 100 },
        { type: "slider", height: 24, bottom: 8, start: 70, end: 100 },
      ],
      series: [
        {
          name: s.symbol,
          type: "candlestick",
          data: kdata,
          itemStyle: {
            color: "#22c55e",
            color0: "#ef4444",
            borderColor: "#16a34a",
            borderColor0: "#dc2626",
          },
        },
      ],
    };
  }

  function lineOption(s: Series) {
    const rows = (s.candles ?? []).filter((c) => c.c != null).map((c) => ({ d: fmtDate(c.t), y: c.c as number }));
    const dates = rows.map((r) => r.d);
    const y = rows.map((r) => r.y);

    return {
      animation: false,
      grid: { left: 56, right: 24, top: 20, bottom: 40 },
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      xAxis: { type: "category", data: dates, boundaryGap: false, axisLabel: { hideOverlap: true } },
      yAxis: { scale: true },
      dataZoom: [
        { type: "inside", start: 70, end: 100 },
        { type: "slider, height: 24, bottom: 8, start: 70, end: 100" } as unknown as never, // keep types happy if needed
      ],
      series: [{ name: s.symbol, type: "line", showSymbol: false, data: y }],
    };
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">OHLC Probe</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Symbols (comma-sep)</span>
          <input className="rounded border px-3 py-2" value={symbols} onChange={(e) => setSymbols(e.target.value)} />
          <span className="text-xs text-gray-500">CNY→USDCNY=X, CNH→USDCNH=X.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Range</span>
          <input className="rounded border px-3 py-2" value={range} onChange={(e) => setRange(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-500">Interval</span>
          <input className="rounded border px-3 py-2" value={interval} onChange={(e) => setInterval(e.target.value)} />
          <span className="text-xs text-gray-500">Tip: try 1h for CNH/CNY.</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={load} disabled={loading} className="rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-60">
          {loading ? "Loading…" : "Load"}
        </button>
        <code className="text-xs text-gray-500">{query}</code>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">Error: {err}</div>}

      {data && (
        <div className="space-y-8">
          {data.results.map((s) => {
            const flat = s.ok && mostlyFlat(s);
            return (
              <div key={s.symbol} className="rounded-2xl border p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium">{s.symbol}</div>
                  <div className="text-xs text-gray-500">
                    {data.range} • {data.interval} • {s.source}
                  </div>
                </div>
                {flat && (
                  <div className="mb-2 text-xs text-amber-600">
                    Daily OHLC not provided for many bars. Showing close-only line. Try interval <code>1h</code>.
                  </div>
                )}
                <ReactECharts
                  style={{ height: 380, width: "100%" }}
                  opts={{ renderer: "svg" }}
                  option={flat ? lineOption(s) : candleOption(s)}
                  notMerge
                  lazyUpdate
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
