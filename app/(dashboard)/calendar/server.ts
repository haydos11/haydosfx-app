// app/(dashboard)/calendar/server.ts
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import type { IngestEvent, CalendarEventRow } from "./types";

/* ---------------- utils ---------------- */
function toISO(x: string | number): string {
  if (typeof x === "number") {
    const ms = x < 1e12 ? x * 1000 : x; // allow seconds or ms
    return new Date(ms).toISOString();
  }
  return new Date(x).toISOString();
}

function stableCode(ev: IngestEvent): string {
  if (ev.event_code && ev.event_code.trim()) return ev.event_code.trim();
  const base = `${ev.country}__${ev.title}__${toISO(ev.occurs_at)}`;
  return "auto_" + crypto.createHash("sha1").update(base).digest("hex");
}

/** Convert any date-like to epoch seconds (rounded down). */
function toEpochSeconds(d: string | number | Date): number {
  if (typeof d === "number") {
    const ms = d < 1e12 ? d * 1000 : d;
    return Math.floor(ms / 1000);
  }
  const ms = new Date(d).getTime();
  return Math.floor(ms / 1000);
}

/** Turn a DB 'release_time_utc' (bigint seconds OR ISO/timestamp) into ISO string. */
function fromDbReleaseToISO(x: number | string | Date): string {
  if (typeof x === "number") {
    const ms = x < 1e12 ? x * 1000 : x; // seconds → ms (or already ms)
    return new Date(ms).toISOString();
  }
  if (x instanceof Date) return x.toISOString();
  // string path (timestamp/ISO) → ISO
  return new Date(x).toISOString();
}

/* =========================================================
   Upsert “event metadata” (unchanged behavior)
========================================================= */
export async function upsertCalendarEvents(raw: IngestEvent[]) {
  const rows = raw
    .map((ev) => {
      const occurs_at = toISO(ev.occurs_at);
      const event_code = stableCode(ev);
      return {
        country: ev.country?.toUpperCase().trim(),
        title: ev.title?.trim(),
        event_code,
        occurs_at,
        importance: ev.importance ?? null,
        actual: ev.actual ?? null,
        forecast: ev.forecast ?? null,
        previous: ev.previous ?? null,
        unit: ev.unit ?? null,
        source: ev.source ?? null,
      };
    })
    .filter((r) => r.country && r.title && r.occurs_at);

  if (!rows.length) return { received: raw.length, upserted: 0 };

  let upserted = 0;
  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { data, error, count } = await supabaseAdmin
      .from("calendar_events")
      .upsert(chunk, {
        onConflict: "event_code,country,title,occurs_at",
        ignoreDuplicates: false,
        count: "estimated",
      })
      .select("id");

    if (error) throw new Error(error.message);
    upserted += count ?? (data?.length ?? 0);
  }

  return { received: raw.length, upserted };
}

/* =========================================================
   Query directly from base tables (no view)
   Tables/columns assumed:
   - calendar_values:
       id, event_id, release_time_utc, actual_value, forecast_value,
       previous_value, revised_prev_value
   - calendar_events:
       id, title, event_code, importance_enum, unit_enum, country_id
   - calendar_countries:
       id, code
   - calendar_unit_map:
       id, text
========================================================= */

// Helpers for array/object tolerant joins (Supabase can return arrays for nested relations)
type MaybeArr<T> = T | T[];
const first = <T>(x: MaybeArr<T> | null | undefined): T | null =>
  Array.isArray(x) ? (x[0] ?? null) : (x ?? null);

type UnitMapRow = { id: number; text: string | null };

type ValuesSelectRow = {
  id: number;
  event_id: number;
  release_time_utc: number | string | Date;
  actual_value: number | null;
  forecast_value: number | null;
  previous_value: number | null;
  revised_prev_value: number | null;
  event: MaybeArr<{
    id: number | null;
    title: string | null;
    event_code: string | number | null;
    importance_enum: number | null;
    unit_enum: number | null;
    country: MaybeArr<{
      code: string | null;
    }> | null;
  }> | null;
};

export async function queryCalendar(opts: {
  startISO: string;
  endISO: string;
  countries?: string[];
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const countryCodes = (opts.countries ?? []).map((c) => c.toUpperCase().trim());

  const startSec = toEpochSeconds(opts.startISO);
  const endSec = toEpochSeconds(opts.endISO);

  // Fetch unit map (enum -> text) in parallel with data
  const unitMapPromise = supabaseAdmin.from("calendar_unit_map").select("id,text");

  // Build a base query from calendar_values joining events and countries.
  // We intentionally do NOT paginate at the DB level so that we can apply
  // a country filter on the joined country.code reliably, then paginate in-memory.
  const HARD_CAP = 5000;

  const baseSelect = `
    id,
    event_id,
    release_time_utc,
    actual_value,
    forecast_value,
    previous_value,
    revised_prev_value,
    event:calendar_events(
      id,
      title,
      event_code,
      importance_enum,
      unit_enum,
      country:calendar_countries(code)
    )
  ` as const;

  // First attempt: treat release_time_utc as epoch seconds (numeric)
  let valuesResp = await supabaseAdmin
    .from("calendar_values")
    .select(baseSelect, { count: "exact" })
    .gte("release_time_utc", startSec)
    .lt("release_time_utc", endSec)
    .order("release_time_utc", { ascending: true })
    .limit(HARD_CAP);

  // If the column is a timestamp (not numeric), retry with ISO filters
  if (valuesResp.error?.message?.includes("operator does not exist")) {
    valuesResp = await supabaseAdmin
      .from("calendar_values")
      .select(baseSelect, { count: "exact" })
      .gte("release_time_utc", opts.startISO)
      .lt("release_time_utc", opts.endISO)
      .order("release_time_utc", { ascending: true })
      .limit(HARD_CAP);
  }

  const [{ data: unitRows, error: unitErr }, { data, error }] = await Promise.all([
    unitMapPromise,
    Promise.resolve(valuesResp),
  ]);

  if (unitErr) throw new Error(unitErr.message);
  if (error) throw new Error(error.message);

  // --- Typed unit map (no 'any')
  const unitMap = new Map<number, string>(
    (unitRows ?? []).map((r) => [Number((r as UnitMapRow).id), String((r as UnitMapRow).text ?? "")])
  );

  // --- Typed result rows (tolerant of array-shaped joins)
  const rows = (data ?? []) as unknown as ValuesSelectRow[];

  const allItems: CalendarEventRow[] = rows.map((v) => {
    const ev = first(v.event);
    const country = first(ev?.country ?? null);
    const occursISO = fromDbReleaseToISO(v.release_time_utc);

    const item: CalendarEventRow = {
      id: v.id,
      occurs_at: occursISO,
      country: String(country?.code ?? "").toUpperCase(),
      title: String(ev?.title ?? ""),
      importance: typeof ev?.importance_enum === "number" ? ev!.importance_enum : null,

      actual: typeof v.actual_value === "number" ? v.actual_value : null,
      forecast: typeof v.forecast_value === "number" ? v.forecast_value : null,
      previous: typeof v.previous_value === "number" ? v.previous_value : null,
      revised_previous:
        typeof v.revised_prev_value === "number" ? v.revised_prev_value : null,

      unit:
        typeof ev?.unit_enum === "number"
          ? unitMap.get(ev.unit_enum) ?? null
          : null,

      event_code:
        ev?.event_code != null ? String(ev.event_code) : String(v.event_id ?? v.id),

      // Keep these aligned with your existing struct
      created_at: occursISO,
      updated_at: occursISO,
      multiplier: null,
      multiplier_power: null,
      unit_multiplier: null,
    };

    return item;
  });

  // Optional country filter (by code), applied in-memory for reliability
  const filtered = countryCodes.length
    ? allItems.filter((x) => countryCodes.includes(x.country))
    : allItems;

  // In-memory pagination after filtering
  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const items = filtered.slice(startIdx, endIdx);

  return {
    page,
    pageSize,
    total,
    items,
  };
}