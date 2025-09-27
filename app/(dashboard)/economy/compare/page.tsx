"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import SafeEChart from "@/components/charts/SafeEChart";

type Point = { date: string; value: number };
type Series = {
  id: string;
  label: string;
  units: "level" | "pct";
  decimals: number;
  latest: number | null;
  latestDate: string | null;
  points: Point[];
};

// moved outside the component so it doesn't trigger hook deps warnings
function startFor(r: "5y" | "10y" | "max"): string {
  if (r === "max") return "1990-01-01";
  const d = new Date();
  if (r === "5y") d.setFullYear(d.getFullYear() - 5);
  else d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().slice(0, 10);
}

export default function ComparePage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<"5y" | "10y" | "max">("10y");
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const start = startFor(range);
    (async () => {
      try {
        const res = await fetch(
          `/api/economy?country=global&set=compare&start=${start}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(await res.text());
        const json: { series: Series[] } = await res.json();
        const s = json.series ?? [];
        setSeries(s);
        setActive((prev) => {
          const next: Record<string, boolean> = {};
          s.forEach((x) => (next[x.id] = prev[x.id] ?? true));
          return next;
        });
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [range]);

  const visible = useMemo(
    () => series.filter((s) => active[s.id]),
    [series, active]
  );

  const option: EChartsOption = useMemo(() => {
    const opt: EChartsOption = {
      animation: false,
      grid: { left: 8, right: 8, top: 12, bottom: 48 },
      xAxis: {
        type: "time",
        // boundaryGap is not needed for time axis; omitting avoids TS mismatch
      },
      yAxis: { type: "value" },
      legend: { bottom: 8, textStyle: { color: "#cbd5e1" } },
      tooltip: { trigger: "axis", axisPointer: { type: "line" } },
      series: visible.map((s) => ({
        name: s.label,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        data: s.points.map((p) => [p.date, p.value]),
      })),
    };
    return opt;
  }, [visible]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["5y", "10y", "max"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              range === r
                ? "bg-violet-600 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {err && <div className="text-red-400">{err}</div>}

      <div className="rounded-xl border border-white/5 bg-black/40 p-2">
        <SafeEChart height={420} option={option} />
      </div>
    </div>
  );
}
