"use client";
import dynamic from "next/dynamic";
import Header from "../components/Header";
import { useEffect, useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type CotRow = { name: string; long: number; short: number };

export default function COTPage() {
  const [rows, setRows] = useState<CotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/cot", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          setErr((json && json.error) || "Failed to load COT");
          setRows([]);
          return;
        }
        setRows(Array.isArray(json) ? json : []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Network error");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const option = useMemo(() => {
    const data = Array.isArray(rows) ? rows : [];
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { textStyle: { color: "#ddd" } },
      grid: { left: 10, right: 10, top: 50, bottom: 40, containLabel: true },
      xAxis: { type: "value", max: 100, axisLabel: { color: "#aaa" }, splitLine: { show: false } },
      yAxis: { type: "category", data: data.map(d => d.name), axisLabel: { color: "#ccc" } },
      series: [
        { name: "Long %", type: "bar", stack: "total", data: data.map(d => d.long) },
        { name: "Short %", type: "bar", stack: "total", data: data.map(d => d.short) },
      ],
    };
  }, [rows]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">COT Dashboard (Live Data)</h1>
          <span className="text-xs text-neutral-400">CFTC Socrata API</span>
        </div>

        {loading && (
          <div className="rounded-lg border border-neutral-800 p-6 text-neutral-300">
            Loading latest report…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-200">
            {err}
          </div>
        )}

        {!loading && !err && (
          <div className="rounded-lg border border-neutral-800 p-4">
            <ReactECharts option={option} style={{ height: 380, width: "100%" }} />
          </div>
        )}
      </div>
    </main>
  );
}
