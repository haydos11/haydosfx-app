// app/(dashboard)/calendar/components/CalendarEventDrawer.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db/supabase-clients";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Info,
  TrendingUp,
  Clock,
  Globe,
  AlertTriangle,
  LineChart as LineChartIcon,
  ExternalLink,
} from "lucide-react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

// Local hard two-thumb slider (so nothing else in the app changes)
import * as SliderPrimitive from "@radix-ui/react-slider";

function RangeSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  className = "",
}: {
  value: number[];
  onValueChange: (v: number[]) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
}) {
  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      className={
        "relative flex w-full touch-none select-none items-center " +
        "[--track-h:8px] [--thumb-s:18px] " +
        "z-30 " +
        className
      }
    >
      <SliderPrimitive.Track className="relative h-[var(--track-h)] w-full grow overflow-hidden rounded-full bg-neutral-800">
        <SliderPrimitive.Range className="absolute z-10 h-full bg-primary bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-rose-500/30" />
      </SliderPrimitive.Track>

      {/* Always TWO thumbs */}
      <SliderPrimitive.Thumb
        aria-label="Start"
        className="relative z-30 block h-[var(--thumb-s)] w-[var(--thumb-s)] rounded-full
                   border border-violet-400/60 bg-neutral-950 shadow
                   hover:ring-2 hover:ring-violet-500/30
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50
                   data-[state=active]:ring-2 data-[state=active]:ring-violet-500/60"
      />
      <SliderPrimitive.Thumb
        aria-label="End"
        className="relative z-30 block h-[var(--thumb-s)] w-[var(--thumb-s)] rounded-full
                   border border-violet-400/60 bg-neutral-950 shadow
                   hover:ring-2 hover:ring-violet-500/30
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50
                   data-[state=active]:ring-2 data-[state=active]:ring-violet-500/60"
      />
    </SliderPrimitive.Root>
  );
}

/* ==============================
   Config & types
============================== */
const APPLY_MULTIPLIER_FACTOR = true;

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: number | string | null;  // back-compat
  valueId?: number | null;           // best: clicked calendar_values.id
  eventCode?: string | null;         // optional
};

type UnitRow = { unit: number; symbol: string | null; name: string | null };
type SectorRow = { sector: number; name: string | null };
type MultiplierRow = { multiplier: number; factor: number; suffix: string | null };

type EventCore = {
  event_id: number;
  event_code?: string | number | null;
  event_name: string;
  country_code: string;
  currency_code?: string | null;
  currency_symbol?: string | null;
  sector_text?: string | null;
  importance_enum?: number | null;
  unit_text?: string | null;
  source_url?: string | null;
};

type EventPoint = {
  id: number;
  event_id: number;
  release_time_utc: string; // ISO
  actual_value: number | null;
  forecast_value: number | null;
  previous_value: number | null;
  revised_prev_value: number | null;
  unit_text?: string | null;
};

type Payload = {
  core: EventCore;
  latest?: EventPoint | null;
  next_time_utc?: string | null;
  history: EventPoint[];
};

type SeriesPoint = { t: string; tms: number; val: number; label: string };
type TooltipPayloadItem<T> = { payload: T };
type TooltipContentPropsLocal<T> = {
  active?: boolean;
  payload?: Array<TooltipPayloadItem<T>>;
  label?: string | number;
};

/* ==============================
   Helpers
============================== */
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function normalizeUtcIso(val: string | number | Date): string {
  if (typeof val === "number") {
    const ms = val < 1e12 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(val)) return new Date(val).toISOString();
    return new Date(val.replace(" ", "T") + "Z").toISOString();
  }
  return new Date().toISOString();
}

/** ✅ Strict decoder for MT5-exported numbers:
 *    1) divide by 1e6
 *    2) apply multiplier factor
 *    3) round by digits
 */
function fromWire(
  val: number | null | undefined,
  digits?: number | null,
  multiplierFactor?: number | null
): number | null {
  if (val == null) return null;
  let x = val / 1_000_000;                        // <-- always divide first
  if (APPLY_MULTIPLIER_FACTOR) x *= (multiplierFactor ?? 1); // then multiplier
  if (Number.isFinite(digits as number)) {        // then digits rounding
    const d = Math.max(0, Number(digits));
    const f = Math.pow(10, d);
    x = Math.round(x * f) / f;
  }
  return x;
}

async function loadUnitMap(): Promise<Map<number, UnitRow>> {
  const r = await supabase.from("calendar_unit_map").select("unit,symbol,name");
  if (r.error) return new Map();
  const map = new Map<number, UnitRow>();
  (r.data ?? []).forEach((row: UnitRow) => map.set(row.unit, row));
  return map;
}
async function loadSectorMap(): Promise<Map<number, string>> {
  const r = await supabase.from("calendar_sector_map").select("sector,name");
  if (r.error) return new Map();
  const map = new Map<number, string>();
  (r.data ?? []).forEach((row: SectorRow) => map.set(row.sector, row.name ?? ""));
  return map;
}
async function loadMultiplierMap(): Promise<Map<number, { factor: number; suffix: string }>> {
  const tryTables = ["calendar_multiplier_map", "calendar_muliplier_map"];
  for (const tbl of tryTables) {
    const r = await supabase.from(tbl).select("multiplier,factor,suffix");
    if (!r.error && r.data) {
      const map = new Map<number, { factor: number; suffix: string }>();
      (r.data as MultiplierRow[]).forEach((row) =>
        map.set(row.multiplier, { factor: Number(row.factor), suffix: row.suffix ?? "" })
      );
      return map;
    }
  }
  return new Map();
}

function buildUnitLabel(
  unitId: number | null | undefined,
  multiplierId: number | null | undefined,
  unitMap: Map<number, UnitRow>,
  multMap: Map<number, { factor: number; suffix: string }>,
  countryCurrency?: string | null,
  countrySymbol?: string | null
): string | null {
  if (unitId == null) return null;
  const u = unitMap.get(unitId);
  const isNone = (t?: string | null) => (t ?? "").trim().toLowerCase() === "none";

  let symbol = u?.symbol ?? null;
  if (symbol === "CUR") symbol = countrySymbol || countryCurrency || null;
  if (symbol === "—") symbol = "";

  const rawSuffix = multiplierId != null ? (multMap.get(multiplierId)?.suffix ?? "") : "";
  const suffix = APPLY_MULTIPLIER_FACTOR ? "" : rawSuffix;

  const parts: string[] = [];
  if (symbol && symbol.trim()) parts.push(symbol.trim());
  if (suffix && suffix.trim()) parts.push(suffix.trim());
  const label = parts.join(" ");
  if (label) return label;
  if (!isNone(u?.name)) return u?.name ?? null;
  return null;
}

/* ==============================
   Data fetcher
============================== */
type EventsRow = {
  id: number;
  event_code?: string | number | null;
  name: string;
  country_id: number | null;
  sector?: number | null;
  importance?: number | null;
  unit?: number | null;
  multiplier?: number | null;
  digits?: number | null;
  source_url?: string | null;
};
type CountryRow = { code: string | null; currency: string | null; currency_symbol: string | null };
type ValuesRow = {
  id: number;
  event_id: number;
  time: number | string | Date;
  actual_value: number | null;
  forecast_value: number | null;
  prev_value: number | null;
  revised_prev_value: number | null;
  event?: { unit?: number | null; multiplier?: number | null; digits?: number | null } | null;
};

async function resolveEventIdFromAny(target: {
  valueId?: number | null;
  eventId?: number | string | null;
  eventCode?: string | null;
}): Promise<number | null> {
  if (isNum(target.valueId)) {
    const r = await supabase
      .from("calendar_values")
      .select("event_id")
      .eq("id", target.valueId)
      .maybeSingle();
    if (r.error) throw new Error(r.error.message);
    const id = r.data?.event_id as number | undefined;
    if (isNum(id)) return id;
  }
  if (isNum(target.eventId)) return target.eventId as number;

  if (typeof target.eventCode === "string" && target.eventCode.trim()) {
    const r = await supabase
      .from("calendar_events")
      .select("id")
      .eq("event_code", target.eventCode.trim())
      .maybeSingle();
    if (r.error) throw new Error(r.error.message);
    const id = r.data?.id as number | undefined;
    if (isNum(id)) return id;
  }
  if (typeof target.eventId === "string" && target.eventId.trim()) {
    const r = await supabase
      .from("calendar_events")
      .select("id")
      .eq("event_code", target.eventId.trim())
      .maybeSingle();
    if (r.error) throw new Error(r.error.message);
    const id = r.data?.id as number | undefined;
    if (isNum(id)) return id;
  }
  return null;
}

async function fetchPayload(target: {
  valueId?: number | null;
  eventId?: number | string | null;
  eventCode?: string | null;
}): Promise<Payload> {
  const [unitMap, sectorMap, multMap] = await Promise.all([
    loadUnitMap(),
    loadSectorMap(),
    loadMultiplierMap(),
  ]);

  const event_id = await resolveEventIdFromAny(target);
  if (!event_id) throw new Error("Could not resolve event id");

  const er = await supabase
    .from("calendar_events")
    .select(`
      id,
      event_code,
      name,
      country_id,
      sector,
      importance,
      unit,
      multiplier,
      digits,
      source_url
    `)
    .eq("id", event_id)
    .maybeSingle();
  if (er.error) throw new Error(er.error.message);
  const ev = (er.data as EventsRow) ?? null;
  if (!ev) throw new Error("Event not found");

  let country: CountryRow | null = null;
  if (ev.country_id != null) {
    const cr = await supabase
      .from("calendar_countries")
      .select(`code,currency,currency_symbol`)
      .eq("id", ev.country_id)
      .maybeSingle();
    if (cr.error) throw new Error(cr.error.message);
    country = (cr.data as CountryRow) ?? null;
  }

  const unitText = buildUnitLabel(
    ev.unit ?? null,
    ev.multiplier ?? null,
    unitMap,
    multMap,
    country?.currency ?? null,
    country?.currency_symbol ?? null
  );

  const core: EventCore = {
    event_id: ev.id,
    event_code: ev.event_code ?? null,
    event_name: ev.name,
    country_code: country?.code ?? "—",
    currency_code: country?.currency ?? null,
    currency_symbol: country?.currency_symbol ?? null,
    sector_text: ev.sector != null ? sectorMap.get(ev.sector) ?? null : null,
    importance_enum: ev.importance ?? null,
    unit_text: unitText,
    source_url: ev.source_url ?? null,
  };

  // pull history with event subselect to read per-row digits/unit/multiplier if present
  const baseSelect = `
    id,
    event_id,
    time,
    actual_value,
    forecast_value,
    prev_value,
    revised_prev_value,
    event:calendar_events(unit,multiplier,digits)
  ` as const;

  const vr = await supabase
    .from("calendar_values")
    .select(baseSelect)
    .eq("event_id", event_id)
    .order("time", { ascending: false })
    .limit(500);
  if (vr.error) throw new Error(vr.error.message);

  const history: EventPoint[] = ((vr.data as ValuesRow[]) ?? []).map((v) => {
    const digits = v?.event?.digits ?? ev.digits ?? 0;
    const factor =
      (v?.event?.multiplier ?? ev.multiplier) != null
        ? (multMap.get((v?.event?.multiplier ?? ev.multiplier)!)?.factor ?? 1)
        : 1;

    const unitTextHist = buildUnitLabel(
      v?.event?.unit ?? ev.unit ?? null,
      v?.event?.multiplier ?? ev.multiplier ?? null,
      unitMap,
      multMap,
      country?.currency ?? null,
      country?.currency_symbol ?? null
    );

    return {
      id: v.id,
      event_id: v.event_id,
      release_time_utc: normalizeUtcIso(v.time),
      actual_value: fromWire(v.actual_value, digits, factor),
      forecast_value: fromWire(v.forecast_value, digits, factor),
      previous_value: fromWire(v.prev_value, digits, factor),
      revised_prev_value: fromWire(v.revised_prev_value, digits, factor),
      unit_text: unitTextHist,
    };
  });

  // latest = most recent non-empty historical (<= now)
  const nowMsLocal = Date.now();
  const latest =
    history
      .filter(
        (h) =>
          +new Date(h.release_time_utc) <= nowMsLocal &&
          (h.actual_value != null ||
            h.forecast_value != null ||
            h.previous_value != null ||
            h.revised_prev_value != null)
      )
      .sort((a, b) => +new Date(b.release_time_utc) - +new Date(a.release_time_utc))[0] ??
    history[0] ??
    null;

  // next scheduled (future strictly)
  const nowSec = Math.floor(Date.now() / 1000);
  const nr = await supabase
    .from("calendar_values")
    .select(`time`)
    .eq("event_id", event_id)
    .gt("time", nowSec)
    .order("time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nr.error) throw new Error(nr.error.message);

  const next_time_utc =
    nr.data?.time != null ? normalizeUtcIso(nr.data.time as number | string | Date) : null;

  return { core, latest, next_time_utc, history };
}

/* ==============================
   Time + range helpers
============================== */
const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function fmtISODate(dms: number) {
  const d = new Date(dms);
  return d.toISOString().slice(0, 10);
}

/* ==============================
   UI helpers
============================== */
function impactTone(importance?: number | null) {
  switch (importance) {
    case 3: return { label: "High", className: "bg-red-500/15 text-red-300 border-red-600/40" };
    case 2: return { label: "Moderate", className: "bg-amber-500/15 text-amber-300 border-amber-600/40" };
    default: return { label: "Low", className: "bg-emerald-500/15 text-emerald-300 border-emerald-600/40" };
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
function fmtDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}
function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/* ==============================
   Component
============================== */
export default function CalendarEventDrawer(props: DrawerProps) {
  const { open, onOpenChange } = props;

  const target = useMemo(
    () => ({
      valueId: props.valueId ?? null,
      eventId:
        typeof props.eventId === "number"
          ? props.eventId
          : typeof props.eventId === "string"
          ? props.eventId
          : null,
      eventCode: props.eventCode ?? null,
    }),
    [props.valueId, props.eventId, props.eventCode]
  );

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Domain & selection
  const [domain, setDomain] = useState<[number, number] | null>(null);
  const [range, setRange] = useState<number[] | null>(null);

  useEffect(() => {
    let cancel = false;
    async function run() {
      if (!open) return;
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const payload = await fetchPayload(target);
        if (cancel) return;
        setData(payload);

        const nowMs = Date.now();
        // Build domain from history up to now only
        const allMs = payload.history
          .map((h) => +new Date(h.release_time_utc))
          .filter((n) => Number.isFinite(n) && n <= nowMs);

        if (allMs.length) {
          const minAll = Math.min(...allMs);
          const maxAll = Math.max(...allMs);
          const defLo = clamp(maxAll - 5 * YEAR_MS, minAll, maxAll); // default 5Y
          setDomain([minAll, maxAll]);
          setRange([defLo, maxAll]);
        } else {
          setDomain(null);
          setRange(null);
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    run();
    return () => { cancel = true; };
  }, [open, target]);

  const nowMs = Date.now();

  // Full series (oldest → newest), excluding future points
  const seriesAll = useMemo<SeriesPoint[]>(() => {
    if (!data) return [];
    const hist = [...data.history].reverse();
    return hist
      .map((p) => {
        const val = p.actual_value ?? p.forecast_value ?? null;
        const tms = +new Date(p.release_time_utc);
        return {
          t: new Date(p.release_time_utc).toISOString().slice(0, 10),
          tms,
          val: val === null ? NaN : val,
          label: fmtNum(val, p.unit_text),
        };
      })
      .filter((p) => p.tms <= nowMs);
  }, [data, nowMs]);

  // Windowed series & history
  const series = useMemo<SeriesPoint[]>(() => {
    if (!seriesAll.length || !range) return seriesAll;
    const [lo, hi] = range;
    return seriesAll.filter((p) => p.tms >= lo && p.tms <= hi);
  }, [seriesAll, range]);

  const historyWindow = useMemo<EventPoint[]>(() => {
    if (!data?.history?.length) return [];
    const all = data.history.filter((h) => +new Date(h.release_time_utc) <= nowMs);

    if (!range) {
      return all.sort((a, b) => +new Date(b.release_time_utc) - +new Date(a.release_time_utc));
    }
    const [lo, hi] = range;
    return all
      .filter((h) => {
        const t = +new Date(h.release_time_utc);
        return t >= lo && t <= hi;
      })
      .sort((a, b) => +new Date(b.release_time_utc) - +new Date(a.release_time_utc));
  }, [data, range, nowMs]);

  const impact = impactTone(data?.core.importance_enum ?? null);
  const latest = useMemo(() => {
    if (!data?.history?.length) return null;
    return (
      data.history
        .filter((h) => +new Date(h.release_time_utc) <= nowMs)
        .sort((a, b) => +new Date(b.release_time_utc) - +new Date(a.release_time_utc))[0] ?? null
    );
  }, [data, nowMs]);

  // Presets
  const applyPresetYears = (years: number) => {
    if (!domain) return;
    const [minAll, maxAll] = domain;
    const lo = clamp(maxAll - years * YEAR_MS, minAll, maxAll);
    setRange([lo, maxAll]);
  };
  const applyMax = () => {
    if (!domain) return;
    const [minAll, maxAll] = domain;
    setRange([minAll, maxAll]);
  };

  // Year tick positions (thumb sits on this line)
  const marks = useMemo(() => {
    if (!domain) return [] as { left: string; label?: string; year: number }[];
    const [minAll, maxAll] = domain;
    const startYear = new Date(minAll).getUTCFullYear();
    const endYear = new Date(maxAll).getUTCFullYear();
    const spanYears = endYear - startYear;
    const step = spanYears > 12 ? 3 : spanYears > 6 ? 2 : 1;
    const arr: { left: string; label?: string; year: number }[] = [];
    for (let y = startYear; y <= endYear; y += step) {
      const pos = (Date.UTC(y, 0, 1) - minAll) / (maxAll - minAll);
      arr.push({ left: `${(pos * 100).toFixed(2)}%`, label: `${y}`, year: y });
    }
    return arr;
  }, [domain]);

  const rangeText = domain && range ? `${fmtISODate(range[0])} → ${fmtISODate(range[1])}` : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[48rem] p-0 bg-neutral-950 text-neutral-100 border-neutral-800 flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{data?.core.event_name || "Event details"}</SheetTitle>
        </SheetHeader>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto">
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
              <Badge variant="outline" className={`border ${impact.className}`}>{impact.label}</Badge>
              {data?.core.currency_code ? (
                <Badge variant="outline" className="border border-neutral-700 text-neutral-300">{data.core.currency_code}</Badge>
              ) : null}
              {data?.core.unit_text ? (
                <Badge variant="outline" className="border border-neutral-700 text-neutral-300">Unit: {data.core.unit_text}</Badge>
              ) : null}
            </div>
          </div>

          <Separator className="bg-neutral-800" />

          {/* Stats */}
          <div className="p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Stat label="Actual" value={fmtNum(latest?.actual_value ?? null, latest?.unit_text)} icon={<TrendingUp className="h-4 w-4" />} />
            <Stat label="Forecast" value={fmtNum(latest?.forecast_value ?? null, latest?.unit_text)} />
            <Stat label="Previous" value={fmtNum(latest?.previous_value ?? null, latest?.unit_text)} />
            <Stat label="Revised Prev" value={fmtNum(latest?.revised_prev_value ?? null, latest?.unit_text)} />
          </div>

          <Separator className="bg-neutral-800" />

          {/* Chart + Range */}
          <div className="p-5 md:p-6 space-y-3">
            <div className="flex items-center gap-2 text-neutral-300">
              <LineChartIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Historical Actuals</span>
            </div>

            {/* Range controls */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 md:p-4 relative">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-xs text-neutral-400">
                  Selected: <span className="text-neutral-200">{rangeText}</span>{" "}
                  {series.length ? <span className="text-neutral-500">• {series.length} pts</span> : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={() => applyPresetYears(1)}>1Y</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={() => applyPresetYears(3)}>3Y</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={() => applyPresetYears(5)}>5Y</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={applyMax}>Max</Button>
                </div>
              </div>

              {/* Year tick line */}
              <div className="mt-3 relative h-14">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-0">
                  <div className="h-px bg-neutral-800" />
                  {marks.map((m, i) => (
                    <div key={i} className="absolute -translate-x-1/2" style={{ left: m.left }}>
                      <div className="h-2 w-px bg-neutral-700 mx-auto" />
                      <div className="text-[10px] text-neutral-500 mt-1 select-none">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Colored fill only under selected range */}
                {domain && range ? (() => {
                  const [minAll, maxAll] = domain;
                  const span = Math.max(1, maxAll - minAll);
                  const leftPct = ((range[0] - minAll) / span) * 100;
                  const rightPct = ((range[1] - minAll) / span) * 100;
                  const widthPct = Math.max(0, rightPct - leftPct);
                  return (
                    <div
                      className="pointer-events-none absolute top-[calc(50%-4px)] h-[var(--track-h)] rounded-full
                                 bg-gradient-to-r from-violet-500/25 via-fuchsia-500/20 to-rose-500/25
                                 ring-1 ring-violet-600/20 z-10"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    />
                  );
                })() : null}

                {/* Slider on top of everything */}
                {domain && (
                  <RangeSlider
                    value={range ?? [domain[0], domain[1]]}
                    onValueChange={(v) => {
                      if (v.length === 2 && domain) {
                        const lo = Math.round(v[0] / DAY_MS) * DAY_MS;
                        const hi = Math.round(v[1] / DAY_MS) * DAY_MS;
                        setRange([clamp(lo, domain[0], domain[1]), clamp(hi, domain[0], domain[1])]);
                      }
                    }}
                    min={domain[0]}
                    max={domain[1]}
                    step={DAY_MS}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-1"
                  />
                )}

                {/* drag hint */}
                <div className="absolute -bottom-4 left-0 text-[10px] text-neutral-500">Drag the ◉ handles</div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full rounded-2xl border border-neutral-800 bg-neutral-900/40">
              {loading ? (
                <div className="h-full grid place-items-center text-neutral-400">Loading…</div>
              ) : error ? (
                <div className="h-full grid place-items-center text-rose-300">{error}</div>
              ) : series.length === 0 ? (
                <div className="h-full grid place-items-center text-neutral-500">No history in selected range</div>
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

          {/* History Table (more room + compact) */}
          <div className="p-5 md:p-6 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-200">History</h3>
              <span className="text-[11px] text-neutral-500">{historyWindow.length} rows</span>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-neutral-900/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
                    <tr className="text-neutral-400">
                      <Th>Date</Th>
                      <Th className="text-right">Actual</Th>
                      <Th className="text-right">Forecast</Th>
                      <Th className="text-right">Previous</Th>
                      <Th className="text-right">Revised</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyWindow.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-neutral-500">No rows in selected window</td>
                      </tr>
                    ) : (
                      historyWindow.map((r) => (
                        <tr key={r.id} className="border-t border-neutral-800/70 even:bg-neutral-900/30">
                          <Td>{fmtDateShort(r.release_time_utc)}</Td>
                          <TdRight>{fmtNum(r.actual_value, r.unit_text)}</TdRight>
                          <TdRight>{fmtNum(r.forecast_value, r.unit_text)}</TdRight>
                          <TdRight>{fmtNum(r.previous_value, r.unit_text)}</TdRight>
                          <TdRight>{fmtNum(r.revised_prev_value, r.unit_text)}</TdRight>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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

/* ==============================
   Small UI helpers
============================== */
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
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 font-medium text-left ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 ${className}`}>{children}</td>;
}
function TdRight({ children }: { children: React.ReactNode }) {
  return <Td className="text-right tabular-nums">{children}</Td>;
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
  if ((sector ?? "").toLowerCase().includes("housing")) {
    return "Housing data affects consumption and financial conditions. Strength tightens conditions; weakness can signal slowing demand.";
  }
  return "This indicator can shift rate expectations and liquidity conditions. Watch DXY, front-end yields, and cross-asset correlations around the release.";
}
