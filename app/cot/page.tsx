"use client";
import dynamic from "next/dynamic";
import Header from "../components/Header";
import { useEffect, useState, useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type CotRow = { name: string; long: number; short: number };

export default function COTPage() {
  const [data, setData] = useState<CotRow[]>([]);

  useEffect(() => {
    fetch("/api/cot")
      .then(res => res.json())
      .then(setData)
      .catch(() => setData([]));
  }, []);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { textStyle: { color: "#ddd" } },
    grid: { left: 10, right: 10, top: 50, bottom: 40, containLabel: true },
    xAxis: { type: "value", max: 100, axisLabel: { color: "#aaa" }, splitLine: { show: false } },
    yAxis: { type: "category", data: data.map(d => d.name), axisLabel: { color: "#ccc" } },
    series: [
      { name: "Long %", type: "bar", stack: "total", data: data.map(d => d.long) },
      { name: "Short %", type: "bar", stack: "total", data: data.map(d => d.short) }
    ]
  }), [data]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">COT Dashboard (Live Data)</h1>
          <span className="text-xs text-neutral-400">Pulled from CFTC Socrata API</span>
        </div>
        <div className="rounded-lg border border-neutral-800 p-4">
          <ReactECharts option={option} style={{ height: 380, width: "100%" }} />
        </div>
      </div>
    </main>
  );
}
