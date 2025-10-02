// app/(dashboard)/calendar/components/CalendarEventDrawer.tsx
"use client";
import React, { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, Clock, Globe, AlertTriangle, LineChart as LineChartIcon, ExternalLink } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { useCalendarEvent } from "../hooks/useCalendar";

/**
 * CalendarEventDrawer (hook-powered)
 *
 * Uses useCalendarEvent(eventId) to fetch core metadata + history directly from Supabase.
 * Parent controls open state and supplies eventId (from the clicked row).
 */

function impactTone(importance?: number | null) {
  switch (importance) {
    case 3:
      return { label: "High", className: "bg-red-500/15 text-red-300 border-red-600/40" };
    case 2:
      return { label: "Moderate", className: "bg-amber-500/15 text-amber-300 border-amber-600/40" };
    default:
      return { label: "Low", className: "bg-emerald-500/15 text-emerald-300 border-emerald-600/40" };
  }
}

function fmtNum(v: number | null | undefined, unit?: string | null) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000_000_000) s = `${(v / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) s = `${(v / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) s = `${(v / 1_000).toFixed(2)}K`;
  else s = `${v.toFixed(2)}`;
  return unit ? `${s}${unit}` : s;
}

function fmtTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Recharts series point type
type SeriesPoint = { t: string; val: number; label: string };

// Minimal tooltip content props (avoid version-specific Recharts types)
type TooltipPayloadItem<T> = { payload: T };
type TooltipContentPropsLocal<T> = {
  active?: boolean;
  payload?: Array<TooltipPayloadItem<T>>;
  label?: string | number;
};

export default function CalendarEventDrawer({
  open,
  eventId,
  onOpenChange,
}: {
  open: boolean;
  eventId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, loading, error } = useCalendarEvent(eventId);

  const series = useMemo<SeriesPoint[]>(() => {
    if (!data) return [];
    const hist = [...data.history].reverse(); // oldest → newest for chart
    return hist.map((p) => {
      const val = p.actual_value ?? p.forecast_value ?? null;
      return {
        t: new Date(p.release_time_utc).toISOString().slice(0, 10),
        val: val === null ? NaN : val,
        label: fmtNum(val, p.unit_text),
      };
    });
  }, [data]);

  const impact = impactTone(data?.core.importance_enum ?? null);
  const latest = data?.latest || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[48rem] p-0 bg-neutral-950 text-neutral-100 border-neutral-800">
        {/* A11y title required by Radix/Dialog */}
        <SheetHeader className="sr-only">
          <SheetTitle>{data?.core.event_name || "Event details"}</SheetTitle>
        </SheetHeader>

        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-5 md:p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <Globe className="h-4 w-4" />
              <span className="uppercase tracking-wide">{data?.core.country_code}</span>
              <span className="text-neutral-600">•</span>
              <span>{data?.core.sector_text || "Macro"}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl md:text-2xl font-semibold leading-tight">
                {data?.core.event_name || (loading ? "Loading…" : error ? "Failed to load" : "Event")}
              </h2>
              {data?.core.source_url ? (
                <a
                  href={data.core.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className={`border ${impact.className}`}>
                {impact.label}
              </Badge>
              {data?.core.currency_code ? (
                <Badge variant="outline" className="border border-neutral-700 text-neutral-300">
                  {data.core.currency_code}
                </Badge>
              ) : null}
              {data?.core.unit_text ? (
                <Badge variant="outline" className="border border-neutral-700 text-neutral-300">
                  Unit: {data.core.unit_text}
                </Badge>
              ) : null}
            </div>
          </div>

          <Separator className="bg-neutral-800" />

          {/* Stats strip */}
          <div className="p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Stat label="Actual" value={fmtNum(latest?.actual_value ?? null, latest?.unit_text)} icon={<TrendingUp className="h-4 w-4" />} />
            <Stat label="Forecast" value={fmtNum(latest?.forecast_value ?? null, latest?.unit_text)} />
            <Stat label="Previous" value={fmtNum(latest?.previous_value ?? null, latest?.unit_text)} />
            <Stat label="Revised Prev" value={fmtNum(latest?.revised_prev_value ?? null, latest?.unit_text)} />
          </div>

          <Separator className="bg-neutral-800" />

          {/* Chart */}
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3 text-neutral-300">
              <LineChartIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Historical Actuals</span>
            </div>
            <div className="h-64 w-full rounded-2xl border border-neutral-800 bg-neutral-900/40">
              {loading ? (
                <div className="h-full grid place-items-center text-neutral-400">Loading…</div>
              ) : series.length === 0 ? (
                <div className="h-full grid place-items-center text-neutral-500">No history</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="t" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={{ stroke: "#404040" }} tickLine={{ stroke: "#404040" }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={{ stroke: "#404040" }} tickLine={{ stroke: "#404040" }} />
                    <RTooltip
                      content={(props: TooltipContentPropsLocal<SeriesPoint>) => {
                        if (!props.active || !props.payload?.length) return null;
                        const p = props.payload[0]?.payload;
                        if (!p) return null;
                        return (
                          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200">
                            <div className="font-medium">{String(props.label ?? "")}</div>
                            <div className="text-neutral-400">{p.label}</div>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="val" dot={false} stroke="#7c3aed" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <Separator className="bg-neutral-800" />

          {/* Narrative */}
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-2 text-neutral-200">
              <Info className="h-5 w-5 mt-0.5 text-neutral-400" />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Why it matters</h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  {renderExplainer(data?.core.event_name, data?.core.sector_text)}
                </p>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Last release: {fmtTime(data?.latest?.release_time_utc)}</span>
                  {data?.next_time_utc ? (
                    <>
                      <span>•</span>
                      <span>Next: {fmtTime(data.next_time_utc)}</span>
                    </>
                  ) : null}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200">
                        <AlertTriangle className="h-4 w-4 mr-1.5" /> Use responsibly
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      AI/narrative content is informational only. Combine with price action, session flows, and your playbook before trading.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs text-neutral-400 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function renderExplainer(eventName?: string, sector?: string | null) {
  if (!eventName) return "This indicator can influence risk appetite and FX flows if it deviates from expectations.";
  const name = eventName.toLowerCase();
  if (name.includes("payroll") || name.includes("employment") || name.includes("jobs")) {
    return "Employment data is a leading signal for growth and inflation pressure. Strong beats tend to support the domestic currency via higher rate expectations; misses can weigh on risk assets.";
  }
  if (name.includes("inflation") || name.includes("cpi") || name.includes("ppi") || name.includes("price")) {
    return "Inflation prints drive central bank policy. Hotter-than-expected readings can lift yields and the currency; softer prints often ease yields and support equities.";
  }
  if (name.includes("gdp")) {
    return "GDP tracks overall economic growth. Surprises move rate expectations and risk sentiment, with FX reacting most when the policy path is in question.";
  }
  if (sector?.toLowerCase().includes("housing")) {
    return "Housing data affects consumption and financial conditions. Strength tightens conditions; weakness can signal slowing demand.";
  }
  return "This indicator can shift rate expectations and liquidity conditions. Watch DXY, front-end yields, and cross-asset correlations around the release.";
}
