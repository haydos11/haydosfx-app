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
   Query from the “human” view (typed, no any)
   View columns assumed (rename if your view differs):
   - id
   - release_time_utc
   - country_code
   - event_name
   - impact_enum, importance_enum
   - actual_num, forecast_num, previous_num
   - revised_prev_value, revised_previous_num
   - unit_text
   - multiplier_suffix (ignored)
   - event_code (optional; if absent we fallback to id)
========================================================= */

type CalendarValuesHumanRow = {
  id: number;
  release_time_utc: string | number | Date;
  country_code: string | null;
  event_name: string | null;
  impact_enum: number | null;
  importance_enum: number | null;
  actual_num: number | null;
  forecast_num: number | null;
  previous_num: number | null;
  revised_prev_value: number | null;
  revised_previous_num: number | null;
  unit_text: string | null;
  multiplier_suffix?: string | null;
  event_code?: string | number | null;
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

  // Optional country filter
  const countryCodes = (opts.countries ?? []).map((c) => c.toUpperCase());

  // Build query
  let q = supabaseAdmin
    .from("calendar_values_human")
    .select(
      `
      id,
      release_time_utc,
      country_code,
      event_name,
      impact_enum,
      importance_enum,
      actual_num,
      forecast_num,
      previous_num,
      revised_prev_value,
      revised_previous_num,
      unit_text,
      multiplier_suffix,
      event_code
    `,
      { count: "exact" }
    )
    .gte("release_time_utc", opts.startISO)
    .lte("release_time_utc", opts.endISO);

  if (countryCodes.length) {
    q = q.in("country_code", countryCodes);
  }

  q = q.order("release_time_utc", { ascending: true }).range(
    (page - 1) * pageSize,
    page * pageSize - 1
  );

  const { data, error, count } = await q.returns<CalendarValuesHumanRow[]>();
  if (error) throw new Error(error.message);

  // Map to CalendarEventRow (fully typed)
  const items: CalendarEventRow[] = (data ?? []).map((r) => {
    // Normalize release_time_utc to ISO string
    let occursISO = "";
    if (typeof r.release_time_utc === "string") {
      occursISO = new Date(r.release_time_utc).toISOString();
    } else if (r.release_time_utc instanceof Date) {
      occursISO = r.release_time_utc.toISOString();
    } else {
      const n = Number(r.release_time_utc);
      const ms = n < 1e12 ? n * 1000 : n;
      occursISO = new Date(ms).toISOString();
    }

    // Prefer scaled revised value if present; fallback to raw
    const revised =
      (typeof r.revised_previous_num === "number" ? r.revised_previous_num : null) ??
      (typeof r.revised_prev_value === "number" ? r.revised_prev_value : null);

    // Pick the importance (impact_enum first, else importance_enum)
    const importance =
      (typeof r.impact_enum === "number" ? r.impact_enum : null) ??
      (typeof r.importance_enum === "number" ? r.importance_enum : null);

    const item: CalendarEventRow = {
      id: r.id,
      occurs_at: occursISO,
      country: (r.country_code ?? "").toUpperCase(),
      title: r.event_name ?? "",
      importance,
      actual: typeof r.actual_num === "number" ? r.actual_num : null,
      forecast: typeof r.forecast_num === "number" ? r.forecast_num : null,
      previous: typeof r.previous_num === "number" ? r.previous_num : null,
      revised_previous: revised,
      unit: r.unit_text ?? null,

      // Required fields enforced by CalendarEventRow:
      event_code: r.event_code != null ? String(r.event_code) : String(r.id),
      created_at: occursISO,
      updated_at: occursISO,

      // Explicitly null to avoid client double-scaling
      multiplier: null,
      multiplier_power: null,
      unit_multiplier: null,
    };

    return item;
  });

  return {
    page,
    pageSize,
    total: count ?? 0,
    items,
  };
}
