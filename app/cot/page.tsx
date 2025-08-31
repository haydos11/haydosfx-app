"use client";
import dynamic from "next/dynamic";
import Header from "../components/Header";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export default function COTPage() {
  const data = useMemo(() => ([
    { name: "AUD (A6)", long: 80, short: 20 },
    { name: "EUR (E6)", long: 46, short: 54 },
    { name: "GBP (B6)", long: 51, short: 49 },
    { name: "JPY (J6)", long: 39, short: 61 },
    { name: "CAD (D6)", long: 55, short: 45 },
  ]), []);

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
          <h1 className="text-xl font-semibold">COT Dashboard (Preview)</h1>
          <span className="text-xs text-neutral-400">
            Placeholder data. Live CFTC feed coming.
          </span>
        </div>
        <div className="rounded-lg border border-neutral-800 p-4">
          <ReactECharts option={option} style={{ height: 380, width: "100%" }} />
        </div>
      </div>
    </main>
  );
}
