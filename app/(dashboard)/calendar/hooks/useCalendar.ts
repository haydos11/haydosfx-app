// app/(dashboard)/calendar/hooks/useCalendar.ts
"use client";
import { useEffect, useMemo, useState } from "react";
import type { CalendarEventRow } from "../types";
import { supabase } from "@/lib/db/supabase-clients";

/** If true, multiply numeric values by the multiplier factor *after* 1e6 division.
 * If false, keep values un-multiplied and show the suffix (K/M/B/T) in the unit label instead.
 */
const APPLY_MULTIPLIER_FACTOR = true;

/* =========================================================
   Types used by the drawer and list
========================================================= */
export type EventCore = {
  event_id: number;
  event_code?: string | number | null;
  event_name: string;
  country_code: string;
  currency_code?: string | null;   // calendar_countries.currency
  currency_symbol?: string | null; // calendar_countries.currency_symbol
  sector_text?: string | null;     // mapped from events.sector
  importance_enum?: number | null; // events.importance
  unit_text?: string | null;       // pretty label (unit [+ suffix if not applying factor])
  source_url?: string | null;
};

export type EventPoint = {
  id: number;
  event_id: number;
  release_time_utc: string; // ISO (values.time)
  actual_value: number | null;
  forecast_value: number | null;
  previous_value: number | null;
  revised_prev_value: number | null;
  unit_text?: string | null;
};

export type EventPayload = {
  core: EventCore;
  latest?: EventPoint | null;
  next_time_utc?: string | null;
  history: EventPoint[]; // most recent first
};

/* =========================================================
   List hook
========================================================= */
type Params = {
  start: string;            // yyyy-mm-dd
  end: string;              // yyyy-mm-dd
  country?: string;         // "US,GB | sector=Prices | impact=2,3"
  page?: number;
  pageSize?: number;
};

type ResultRow = {
  id: number;
  country: string;           // country_code
  title: string;             // events.name
  event_code: string;        // events.event_code or fallback
  occurs_at: string;         // ISO (from values.time)
  importance: number | null; // events.importance
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  revised_previous: number | null;
  unit: string | null;       // pretty unit (unit [+ suffix if not applying factor], CUR resolved)
  sector_text?: string | null;

  // carried through to let the table open the drawer
  __event_id?: number | null;
};

/* ------------------- helpers ------------------- */
const ENUM_TO_TEXT: Record<number, string> = { 0: "None", 1: "Low", 2: "Moderate", 3: "High" };
const TEXT_TO_ENUM: Record<string, number> = { none: 0, low: 1, moderate: 2, high: 3 };

const aliasCountry = (cc: string) => {
  const m = cc.trim().toUpperCase();
  if (!m) return "";
  if (m === "UK") return "GB";
  if (m === "EA") return "EU";
  return m;
};

function parseFilters(encoded?: string) {
  const out = { countries: [] as string[], sectors: [] as string[], impactEnums: [] as number[], impactTexts: [] as string[] };
  if (!encoded || !encoded.trim()) return out;

  const parts = encoded.split("|").map((s) => s.trim()).filter(Boolean);
  const getVal = (k: string) => parts.find((p) => new RegExp(`^${k}\\s*=`, "i").test(p))?.split("=")[1]?.trim();

  const sectorsPart = getVal("sector");
  const impactPart = getVal("impact");
  if (sectorsPart) out.sectors = sectorsPart.split(",").map((s) => s.trim()).filter(Boolean);

  if (impactPart) {
    const tokens = impactPart.split(",").map((s) => s.trim()).filter(Boolean);
    for (const t of tokens) {
      const n = Number(t);
      if (Number.isFinite(n)) {
        if (n >= 0 && n <= 3) out.impactEnums.push(n);
      } else {
        const e = TEXT_TO_ENUM[t.toLowerCase()];
        if (e != null) { out.impactEnums.push(e); out.impactTexts.push(ENUM_TO_TEXT[e]); }
        else { out.impactTexts.push(t); }
      }
    }
    out.impactEnums = Array.from(new Set(out.impactEnums));
    out.impactTexts = Array.from(new Set(out.impactTexts));
  }

  const countryPart = encoded
    .replace(/(?:^|\|)\s*sector=[^|]*/gi, "")
    .replace(/(?:^|\|)\s*impact=[^|]*/gi, "")
    .replace(/\|/g, "")
    .trim();

  if (countryPart) out.countries = countryPart.split(",").map(aliasCountry).filter(Boolean);
  out.countries = Array.from(new Set(out.countries));
  out.impactEnums = out.impactEnums.filter((n) => n !== 0);
  return out;
}

/** Normalize any DB value into a **real UTC ISO** string */
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

/** Seconds since epoch */
function toEpochSeconds(d: string | number | Date): number {
  if (typeof d === "number") {
    const ms = d < 1e12 ? d * 1000 : d;
    return Math.floor(ms / 1000);
  }
  const ms = new Date(d).getTime();
  return Math.floor(ms / 1000);
}

/** ---------------- mapping table loaders (exact to your schema) ---------------- */
type UnitRow = { unit: number; symbol: string | null; name: string | null };
type SectorRow = { sector: number; name: string | null };
type MultiplierRow = { multiplier: number; factor: number; suffix: string | null };

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
  // Be tolerant of table-name typo: calendar_multiplier_map vs calendar_muliplier_map
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

/** MQL5 stores values as micro-units (value * 1e6). Then optionally apply multiplier factor. Finally round to `digits`. */
function fromMql(val: number | null | undefined, digits?: number | null, multiplierFactor?: number | null): number | null {
  if (val == null) return null;
  const base = val / 1_000_000; // Step 1: micro → normal
  const scaled = APPLY_MULTIPLIER_FACTOR ? base * (multiplierFactor ?? 1) : base; // Step 2: optional factor
  if (digits == null || !Number.isFinite(digits)) return scaled;
  const d = Math.max(0, Number(digits));
  const f = Math.pow(10, d);
  return Math.round(scaled * f) / f; // Step 3: rounding only
}

/** Build unit label from unit + multiplier + country currency (for CUR). */
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

  // Resolve symbol
  let symbol = u?.symbol ?? null;
  if (symbol === "CUR") symbol = countrySymbol || countryCurrency || null;
  if (symbol === "—") symbol = ""; // treat em-dash as no symbol

  // Resolve suffix (skip if we already applied the numeric factor)
  const rawSuffix = multiplierId != null ? (multMap.get(multiplierId)?.suffix ?? "") : "";
  const suffix = APPLY_MULTIPLIER_FACTOR ? "" : rawSuffix;

  // Compose from symbol/suffix only; never append the word "none"
  const pieces: string[] = [];
  if (symbol && symbol.trim()) pieces.push(symbol.trim());
  if (suffix && suffix.trim()) pieces.push(suffix.trim());
  const label = pieces.join(" ");
  if (label) return label;

  // Only fall back to the mapping name when it's not "none"
  if (!isNone(u?.name)) return (u?.name ?? null) || null;

  return null;
}

/* ======= array/object tolerant helpers for Supabase joins ======= */
const first = <T>(x: T | T[] | null | undefined): T | null =>
  Array.isArray(x) ? (x[0] ?? null) : (x ?? null);

type MaybeArr<T> = T | T[];

/* ------------------- useCalendar (list) ------------------- */
export function useCalendar(params: Params) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const parsed = useMemo(() => parseFilters(params.country), [params.country]);
  const { countries, sectors, impactEnums, impactTexts } = parsed;

  const [data, setData] = useState<{ items: CalendarEventRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // stable keys for arrays (for deps + filter sets)
  const countriesKey   = useMemo(() => countries.join(","), [countries]);
  const sectorsKey     = useMemo(() => sectors.join(","), [sectors]);
  const impactEnumsKey = useMemo(() => impactEnums.join(","), [impactEnums]);
  const impactTextsKey = useMemo(() => impactTexts.join(","), [impactTexts]);

  // single dependency key to keep dep-array length constant
  const depsKey = `${params.start}|${params.end}|${page}|${pageSize}|${countriesKey}|${sectorsKey}|${impactEnumsKey}|${impactTextsKey}`;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        if (!params.start || !params.end) throw new Error("missing start/end");

        // --- mapping tables (exact to your schema) ---
        const [unitMap, sectorMap, multMap] = await Promise.all([
          loadUnitMap(),
          loadSectorMap(),
          loadMultiplierMap(),
        ]);

        // --- values → events → countries (include digits & multiplier!) ---
        const HARD_CAP = 5000;
        const baseSelect = `
          id,
          event_id,
          time,
          actual_value,
          forecast_value,
          prev_value,
          revised_prev_value,
          event:calendar_events(
            id,
            name,
            event_code,
            importance,
            unit,
            sector,
            multiplier,
            digits,
            source_url,
            country:calendar_countries(code,currency,currency_symbol)
          )
        ` as const;

        const startSec = toEpochSeconds(`${params.start}T00:00:00Z`);
        // effectively “no upper bound” but keeps the query shape consistent
        const endSec   = Math.floor(Date.parse("2100-01-01T00:00:00Z") / 1000);

        const valuesResp = await supabase
          .from("calendar_values")
          .select(baseSelect)
          .gte("time", startSec)
          .lt("time", endSec)
          .order("time", { ascending: true })
          .limit(HARD_CAP);

        if (valuesResp.error) throw new Error(valuesResp.error.message);

        // ---- Supabase may return arrays for joined objects; type it tolerant, then normalize
        type ValuesSelectRow = {
          id: number;
          event_id: number;
          time: number | string | Date;
          actual_value: number | null;
          forecast_value: number | null;
          prev_value: number | null;
          revised_prev_value: number | null;
          event: MaybeArr<{
            id: number | null;
            name: string | null;
            event_code: string | number | null;
            importance: number | null;
            unit: number | null;
            sector: number | null;
            multiplier: number | null;
            digits: number | null;
            source_url: string | null;
            country: MaybeArr<{
              code: string | null;
              currency: string | null;
              currency_symbol: string | null;
            }> | null;
          }> | null;
        };

        const raw = (valuesResp.data ?? []) as unknown as ValuesSelectRow[];

        // --- map rows → list result shape (apply 1e6 division, multiplier factor, and digits rounding) ---
        const mapped: ResultRow[] = raw.map((v) => {
          const ev = first(v.event);
          const country = first(ev?.country ?? null);

          const digits = Number(ev?.digits ?? 0);
          const factor = ev?.multiplier != null ? (multMap.get(ev.multiplier)?.factor ?? 1) : 1;

          const actual   = fromMql(v.actual_value,       digits, factor);
          const forecast = fromMql(v.forecast_value,     digits, factor);
          const previous = fromMql(v.prev_value,         digits, factor);
          const revised  = fromMql(v.revised_prev_value, digits, factor);

          const unitText = buildUnitLabel(
            ev?.unit ?? null,
            ev?.multiplier ?? null,
            unitMap,
            multMap,
            country?.currency ?? null,
            country?.currency_symbol ?? null
          );
          const sectorText = typeof ev?.sector === "number" ? (sectorMap.get(ev.sector) ?? null) : null;

          return {
            id: v.id,
            country: String(country?.code ?? "").toUpperCase(),
            title: String(ev?.name ?? ""),
            event_code: ev?.event_code != null ? String(ev.event_code) : String(v.event_id ?? v.id),
            occurs_at: normalizeUtcIso(v.time),
            importance: typeof ev?.importance === "number" ? ev.importance : null,
            actual,
            forecast,
            previous,
            revised_previous: revised,
            unit: unitText,
            sector_text: sectorText ?? undefined,

            // carry the numeric calendar_events.id for the drawer
            __event_id: Number(ev?.id ?? v.event_id ?? null) || null,
          } as ResultRow;
        });

        // --- filters ---
        let filtered = mapped;

        if (countriesKey) {
          const setC = new Set(countriesKey.split(","));
          filtered = filtered.filter((r) => setC.has(r.country));
        }
        if (sectorsKey) {
          const setS = new Set(sectorsKey.toLowerCase().split(","));
          filtered = filtered.filter((r) => (r.sector_text ? setS.has(r.sector_text.toLowerCase()) : false));
        }
        if (impactEnumsKey) {
          const setI = new Set(impactEnumsKey.split(",").map((x) => Number(x)));
          filtered = filtered.filter((r) => r.importance != null && setI.has(r.importance));
        } else if (impactTextsKey) {
          const setT = new Set(impactTextsKey.toLowerCase().split(","));
          filtered = filtered.filter((r) => {
            if (r.importance == null) return false;
            const txt = ENUM_TO_TEXT[r.importance]?.toLowerCase();
            return txt ? setT.has(txt) : false;
          });
        }

        // --- pagination after filtering ---
        const total = filtered.length;
        const pageItems = filtered.slice(from, to + 1);

        // Extend CalendarEventRow locally to avoid 'any' when attaching event_id
        type CalendarEventRowAug = CalendarEventRow & { event_id?: number | null };

        const items: CalendarEventRow[] = pageItems.map((r: ResultRow) => {
          const base: CalendarEventRowAug = {
            id: r.id,
            occurs_at: r.occurs_at,
            country: r.country,
            title: r.title,
            importance: r.importance ?? null,
            actual: r.actual,
            forecast: r.forecast,
            previous: r.previous,
            revised_previous: r.revised_previous,
            unit: r.unit,
            event_code: r.event_code,
            created_at: r.occurs_at,
            updated_at: r.occurs_at,
            multiplier: null,
            multiplier_power: null,
            unit_multiplier: null,

            // pass through for the drawer
            event_id: r.__event_id ?? null,
          };
          return base as CalendarEventRow;
        });

        if (!cancelled) setData({ items, total, page, pageSize });
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  return { data, loading, error };
}

/* =========================================================
   useCalendarEvent(eventId) — powers the side drawer
========================================================= */
type EventsTableRow = {
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

type CountryTableRow = {
  code: string | null;
  currency: string | null;
  currency_symbol: string | null;
};

type ValuesRow = {
  id: number;
  event_id: number;
  time: number | string | Date; // BIGINT seconds
  actual_value: number | null;
  forecast_value: number | null;
  prev_value: number | null;
  revised_prev_value: number | null;
  event?: { unit?: number | null; multiplier?: number | null; digits?: number | null } | null;
};

export function useCalendarEvent(eventId: number | string | null) {
  const [data, setData] = useState<EventPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    async function run() {
      if (eventId == null || eventId === "") { setData(null); return; }
      setLoading(true);
      setError(null);

      try {
        // ---------- resolve id: number OR event_code:string ----------
        let idNum: number | null = null;

        if (typeof eventId === "number" && Number.isFinite(eventId)) {
          idNum = eventId;
        } else if (typeof eventId === "string") {
          const trimmed = eventId.trim();
          const maybeNum = Number(trimmed);
          if (Number.isFinite(maybeNum)) {
            idNum = maybeNum;
          } else {
            const lookup = await supabase
              .from("calendar_events")
              .select("id")
              .eq("event_code", trimmed)
              .limit(1)
              .maybeSingle();
            if (lookup.error) throw new Error(lookup.error.message);
            idNum = (lookup.data?.id ?? null) as number | null;
          }
        }

        if (!idNum) throw new Error("Could not resolve event id");

        // ---------- load mapping tables ----------
        const [unitMap, sectorMap, multMap] = await Promise.all([
          loadUnitMap(),
          loadSectorMap(),
          loadMultiplierMap(),
        ]);

        // ---------- 1) Core event ----------
        const r1 = await supabase
          .from("calendar_events")
          .select(
            `
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
            `
          )
          .eq("id", idNum)
          .maybeSingle();
        if (r1.error) throw new Error(r1.error.message);
        const ev = (r1.data as EventsTableRow) ?? null;
        if (!ev) throw new Error("Event not found");

        // 1b) Country
        let countryCode: string | undefined;
        let currencyCode: string | undefined;
        let currencySymbol: string | undefined;
        if (ev.country_id != null) {
          const c = await supabase
            .from("calendar_countries")
            .select(`code, currency, currency_symbol`)
            .eq("id", ev.country_id)
            .maybeSingle();
          if (c.error) throw new Error(c.error.message);
          const crow = c.data as CountryTableRow | null;
          countryCode = crow?.code ?? undefined;
          currencyCode = crow?.currency ?? undefined;
          currencySymbol = crow?.currency_symbol ?? undefined;
        }

        const unitText = buildUnitLabel(ev.unit, ev.multiplier, unitMap, multMap, currencyCode, currencySymbol);
        const core: EventCore = {
          event_id: ev.id,
          event_code: ev.event_code ?? null,
          event_name: ev.name,
          country_code: countryCode ?? "—",
          currency_code: currencyCode ?? null,
          currency_symbol: currencySymbol ?? null,
          sector_text: ev.sector != null ? sectorMap.get(ev.sector) ?? null : null,
          importance_enum: ev.importance ?? null,
          unit_text: unitText,
          source_url: ev.source_url ?? null,
        };

        // ---------- 2) History ----------
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

        const vq = await supabase
          .from("calendar_values")
          .select(baseSelect)
          .eq("event_id", core.event_id)
          .order("time", { ascending: false })
          .limit(500);
        if (vq.error) throw new Error(vq.error.message);

        const history: EventPoint[] = (vq.data as ValuesRow[] ?? []).map((v) => {
          const digits = v?.event?.digits ?? ev.digits ?? 0;
          const factor = (v?.event?.multiplier ?? ev.multiplier) != null
            ? (multMap.get((v?.event?.multiplier ?? ev.multiplier)!)?.factor ?? 1)
            : 1;

          const unitTextHist = buildUnitLabel(
            v?.event?.unit ?? ev.unit,
            v?.event?.multiplier ?? ev.multiplier,
            unitMap,
            multMap,
            currencyCode,
            currencySymbol
          );

          return {
            id: v.id,
            event_id: v.event_id,
            release_time_utc: normalizeUtcIso(v.time),
            actual_value:       fromMql(v.actual_value,       digits, factor),
            forecast_value:     fromMql(v.forecast_value,     digits, factor),
            previous_value:     fromMql(v.prev_value,         digits, factor),
            revised_prev_value: fromMql(v.revised_prev_value, digits, factor),
            unit_text: unitTextHist,
          };
        });

        const latest =
          history.find((h) =>
            h.actual_value != null ||
            h.forecast_value != null ||
            h.previous_value != null ||
            h.revised_prev_value != null
          ) ?? history[0] ?? null;

        // ---------- 3) Next scheduled ----------
        const nowSec = Math.floor(Date.now() / 1000);
        const nextQ = await supabase
          .from("calendar_values")
          .select(`time`)
          .eq("event_id", core.event_id)
          .gt("time", nowSec)
          .order("time", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (nextQ.error) throw new Error(nextQ.error.message);

        type NextRow = { time?: string | number | Date } | null;
        const nextRow = nextQ.data as NextRow;
        const nextVal = nextRow?.time;

        const payload: EventPayload = {
          core,
          latest,
          next_time_utc: nextVal != null ? normalizeUtcIso(nextVal) : null,
          history,
        };

        if (!cancel) setData(payload);
      } catch (e: unknown) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to load event");
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    run();
    return () => { cancel = true; };
  }, [eventId]);

  return { data, loading, error };
}
