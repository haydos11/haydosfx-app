// lib/economy/calendar/shared.ts

import { supabaseAdmin } from "@/lib/db/supabase-admin";
import type { CalendarIndicatorDef, Point } from "@/lib/economy/types";

export type MultiplierRow = {
  multiplier: number;
  factor: number;
  suffix: string | null;
};

export type CalendarCountry =
  | {
      code: string | null;
      currency: string | null;
    }
  | {
      code: string | null;
      currency: string | null;
    }[]
  | null;

export type CalendarEvent =
  | {
      id: number | null;
      name: string | null;
      multiplier: number | null;
      digits: number | null;
      country: CalendarCountry;
    }
  | {
      id: number | null;
      name: string | null;
      multiplier: number | null;
      digits: number | null;
      country: CalendarCountry;
    }[]
  | null;

export type CalendarRawRow = {
  event_id?: number | null;
  time: number | string | Date;
  actual_value: number | null;
  event: CalendarEvent;
};

type CalendarCountryRow = {
  id: number;
  code: string | null;
  currency: string | null;
};

type CalendarEventRow = {
  id: number;
  name: string | null;
  multiplier: number | null;
  digits: number | null;
  country_id?: number | null;
  country:
    | {
        code: string | null;
        currency: string | null;
      }
    | {
        code: string | null;
        currency: string | null;
      }[]
    | null;
};

type CalendarValueBaseRow = {
  event_id: number | null;
  time: number | string | Date;
  actual_value: number | null;
};

const EVENT_ID_CHUNK_SIZE = 500;
const VALUE_PAGE_SIZE = 1000;

export function first<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}

export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[./-]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUtcIso(val: string | number | Date): string {
  if (typeof val === "number") {
    const ms = val < 1e12 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (val instanceof Date) return val.toISOString();

  const s = String(val);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s).toISOString();
  }
  return new Date(s.replace(" ", "T") + "Z").toISOString();
}

export function fromMql(
  val: number | null | undefined,
  digits?: number | null,
  multiplierFactor?: number | null
): number | null {
  if (val == null) return null;

  // Exporter stores values scaled by 1e6
  const base = val / 1_000_000;
  const scaled = base * (multiplierFactor ?? 1);

  if (digits == null || !Number.isFinite(digits)) return scaled;

  const d = Math.max(0, Number(digits));
  const f = Math.pow(10, d);
  return Math.round(scaled * f) / f;
}

export async function loadMultiplierMap(): Promise<
  Map<number, { factor: number; suffix: string }>
> {
  const tryTables = ["calendar_multiplier_map", "calendar_muliplier_map"];

  for (const tbl of tryTables) {
    const res = await supabaseAdmin.from(tbl).select("multiplier,factor,suffix");
    if (!res.error && res.data) {
      const map = new Map<number, { factor: number; suffix: string }>();
      (res.data as MultiplierRow[]).forEach((row) => {
        map.set(Number(row.multiplier), {
          factor: Number(row.factor),
          suffix: row.suffix ?? "",
        });
      });
      return map;
    }
  }

  return new Map();
}

async function fetchCountryIdByCode(countryCode: string): Promise<number> {
  const code = countryCode.toUpperCase();

  const res = await supabaseAdmin
    .from("calendar_countries")
    .select("id,code,currency")
    .eq("code", code)
    .limit(1)
    .maybeSingle();

  if (res.error) {
    throw new Error(`calendar_countries lookup failed: ${res.error.message}`);
  }

  const row = res.data as CalendarCountryRow | null;
  if (!row?.id) {
    throw new Error(`No calendar country found for code: ${code}`);
  }

  return row.id;
}

async function fetchEventsByCountryId(countryId: number): Promise<CalendarEventRow[]> {
  const res = await supabaseAdmin
    .from("calendar_events")
    .select(`
      id,
      name,
      multiplier,
      digits,
      country_id,
      country:calendar_countries(
        code,
        currency
      )
    `)
    .eq("country_id", countryId)
    .limit(10000);

  if (res.error) {
    throw new Error(`calendar_events lookup failed: ${res.error.message}`);
  }

  return (res.data ?? []) as CalendarEventRow[];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function fetchAllCalendarValuesForEventIds(
  eventIds: number[],
  startSec: number
): Promise<CalendarValueBaseRow[]> {
  const all: CalendarValueBaseRow[] = [];
  let from = 0;

  while (true) {
    const to = from + VALUE_PAGE_SIZE - 1;

    const res = await supabaseAdmin
      .from("calendar_values")
      .select("event_id,time,actual_value")
      .in("event_id", eventIds)
      .gte("time", startSec)
      .order("time", { ascending: false })
      .range(from, to);

    if (res.error) {
      throw new Error(`calendar_values lookup failed: ${res.error.message}`);
    }

    const page = (res.data ?? []) as CalendarValueBaseRow[];
    if (!page.length) break;

    all.push(...page);

    if (page.length < VALUE_PAGE_SIZE) break;
    from += VALUE_PAGE_SIZE;
  }

  return all;
}

export async function fetchCalendarRowsForCountry(
  start: string,
  countryCode: string
): Promise<CalendarRawRow[]> {
  const startSec = Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000);

  const countryId = await fetchCountryIdByCode(countryCode);
  const events = await fetchEventsByCountryId(countryId);
  const eventIds = events.map((e) => e.id).filter((id): id is number => Number.isFinite(id));

  if (!eventIds.length) return [];

  const eventMap = new Map<number, CalendarEventRow>();
  for (const ev of events) {
    eventMap.set(ev.id, ev);
  }

  const chunks = chunkArray(eventIds, EVENT_ID_CHUNK_SIZE);

  const chunkResults = await Promise.all(
    chunks.map((ids) => fetchAllCalendarValuesForEventIds(ids, startSec))
  );

  const flat = chunkResults.flat();

  const rows: CalendarRawRow[] = flat.map((row) => {
    const ev = row.event_id != null ? eventMap.get(row.event_id) ?? null : null;

    return {
      event_id: row.event_id,
      time: row.time,
      actual_value: row.actual_value,
      event: ev
        ? {
            id: ev.id,
            name: ev.name,
            multiplier: ev.multiplier,
            digits: ev.digits,
            country: ev.country,
          }
        : null,
    };
  });

  return rows;
}

export function chooseLatestPerDate(rows: Array<{ date: string; value: number }>): Point[] {
  const deduped = new Map<string, Point>();

  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    deduped.set(row.date, { date: row.date, value: row.value });
  }

  return [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildSeriesFromMatchedRows(
  matchedRows: CalendarRawRow[],
  def: CalendarIndicatorDef,
  multMap: Map<number, { factor: number; suffix: string }>
) {
  const normalized: Array<{ date: string; value: number }> = [];

  for (const row of matchedRows) {
    const ev = first(row.event);
    const factor =
      ev?.multiplier != null ? (multMap.get(ev.multiplier)?.factor ?? 1) : 1;
    const digits = ev?.digits ?? def.decimals;

    const value = fromMql(row.actual_value, digits, factor);
    if (value == null || !Number.isFinite(value)) continue;

    const date = normalizeUtcIso(row.time).slice(0, 10);
    normalized.push({ date, value });
  }

  const points = chooseLatestPerDate(normalized);
  if (!points.length) return null;

  const latest = points[points.length - 1];

  return {
    id: def.slug,
    label: def.label,
    units: def.units,
    decimals: def.decimals,
    latest: latest.value,
    latestDate: latest.date,
    points,
  };
}