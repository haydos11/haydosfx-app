"use client";

import React from "react";
import SafeEChart from "@/components/charts/SafeEChart";
import type { EChartsOption, LineSeriesOption } from "echarts";
import { Badge } from "@/components/ui/badge";

type DayPoint = { date: string; value: number };
type ApiOk = { ok: true; days: number; data: Record<string, DayPoint[]> };
type ApiErr = { ok: false; error?: string };

const COLORS: Record<string, string> = {
  AUD: "#1E90FF",
  CAD: "#6A2FB9",
  CHF: "#3AC364",
  EUR: "#E91E63",
  GBP: "#00C389",
  JPY: "#FFA726",
  NZD: "#5C6BC0",
  USD: "#9C27B0",
};
const ORDER = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"] as const;
type Currency = typeof ORDER[number];

function isApiOk(x: unknown): x is ApiOk {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (r.ok !== true) return false;
  if (typeof r.days !== "number") return false;
  if (!r.data || typeof r.data !== "object") return false;
  return true;
}

export default function FxStrengthChart({ days = 30 }: { days?: number }) {
  const [state, setState] = React.useState<ApiOk | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Set<Currency>>(new Set());
  const [hovered, setHovered] = React.useState<Currency | null>(null);
  const [smooth, setSmooth] = React.useState(true);
  const [tooltipOn, setTooltipOn] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fx-strength?days=${days}`, { cache: "no-store" });
        const dataUnknown: unknown = await res.json();
        if (!cancelled) {
          if (isApiOk(dataUnknown)) {
            setState(dataUnknown);
            setErr(null);
          } else {
            const maybeErr = (dataUnknown as ApiErr)?.error ?? "Failed";
            setErr(maybeErr);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (err) return <div className="text-sm text-red-600">Error: {err}</div>;
  if (!state) return <div className="text-sm text-muted-foreground">Loading currency strength…</div>;

  const dates = state.data[ORDER[0]]?.map((p) => p.date) ?? [];

  const series: LineSeriesOption[] = ORDER.map((ccy) => {
    const isSel = selected.has(ccy);
    const isHover = hovered === ccy;
    const width = isSel || isHover ? 4 : 1.5;

    const points = state.data[ccy] ?? [];
    return {
      name: ccy,
      type: "line",
      smooth,
      showSymbol: false,
      lineStyle: { width, opacity: 1 },
      data: points.map((p) => Number(p.value.toFixed(2))),
      emphasis: { focus: "series" },
    };
  });

  const option: EChartsOption = {
    tooltip: tooltipOn
      ? {
          show: true,
          trigger: "axis",
          backgroundColor: "rgba(0,0,0,0.6)",
          borderWidth: 0,
          padding: 8,
          textStyle: { fontSize: 11, lineHeight: 14 },
          axisPointer: { type: "line" },
          formatter: (params) => {
            // params can be a single object or array; we handle both safely
            const arr: Array<unknown> = Array.isArray(params) ? params : [params];

            type Item = {
              value?: number;
              axisValue?: string;
              seriesName?: string;
              color?: string;
            };

            const rows = arr
              .map((p) => p as Item)
              .filter((p): p is Required<Pick<Item, "value" | "axisValue" | "seriesName">> & Item => {
                return typeof p?.value === "number" && Number.isFinite(p.value);
              })
              .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

            const date = rows[0]?.axisValue ?? "";

            const lines = rows
              .map((p) => {
                const val = Number(p.value).toFixed(2);
                const color = (p.seriesName && COLORS[p.seriesName]) || p.color || "#999";
                const name = p.seriesName ?? "";
                return `<div style="display:flex;justify-content:space-between;gap:12px;">
                  <span>
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;"></span>
                    ${name}
                  </span>
                  <span>${val}</span>
                </div>`;
              })
              .join("");

            return `<div style="min-width:160px;">
              <div style="opacity:0.8;margin-bottom:6px;">${date}</div>
              ${lines}
            </div>`;
          },
        }
      : { show: false },

    grid: { left: 28, right: 16, top: 12, bottom: 56 },
    legend: { show: false },
    xAxis: {
      type: "category", // literal type
      data: dates,
      boundaryGap: false,
      axisLabel: { formatter: (d: string) => d.slice(5) },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (v: number) => `${v}` },
      splitLine: { show: true },
    },
    color: ORDER.map((c) => COLORS[c]),
    series,
  };

  const toggleSelect = (ccy: Currency) => {
    const next = new Set(selected);
    if (next.has(ccy)) next.delete(ccy);
    else next.add(ccy);
    setSelected(next);
  };

  return (
    <div className="w-full">
      {/* Currency pills */}
      <div className="mb-3 flex flex-wrap gap-2">
        {ORDER.map((c) => {
          const isSel = selected.has(c);
          return (
            <Badge
              key={c}
              variant="secondary"
              className={`cursor-pointer px-3 py-1 transition ${isSel ? "ring-2 ring-offset-1" : ""}`}
              style={{
                borderColor: COLORS[c],
                color: COLORS[c],
                backgroundColor: isSel ? `${COLORS[c]}20` : undefined,
              }}
              onClick={() => toggleSelect(c)}
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered(null)}
            >
              {c}
            </Badge>
          );
        })}

        {/* Tooltip pill */}
        <Badge
          key="tooltip"
          variant="secondary"
          className={`cursor-pointer px-3 py-1 transition ${tooltipOn ? "ring-2 ring-offset-1" : ""}`}
          style={{
            borderColor: "#666",
            color: "#666",
            backgroundColor: tooltipOn ? "#6662" : undefined,
          }}
          onClick={() => setTooltipOn(!tooltipOn)}
        >
          Tooltip
        </Badge>
      </div>

      <SafeEChart option={option} height={420} />

      <div className="mt-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={smooth}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmooth(e.target.checked)}
          />
          Smooth lines
        </label>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Hover a pill to thicken that line; click a pill to keep it thick.{" "}
        Click “Tooltip” pill to toggle the tooltip.
      </p>
    </div>
  );
}
