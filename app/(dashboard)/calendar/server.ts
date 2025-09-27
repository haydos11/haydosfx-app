// app/(dashboard)/calendar/server.ts
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import type { IngestEvent, CalendarEventRow } from "./types";

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
        source: ev.source ?? null, // URL or null
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
        count: "estimated", // valid in v2 options
        // returning: "representation", // ❌ not supported in your version
      })
      .select("id"); // controls returning rows

    if (error) throw new Error(error.message);
    upserted += count ?? (data?.length ?? 0);
  }

  return { received: raw.length, upserted };
}

export async function queryCalendar(opts: {
  startISO: string;
  endISO: string;
  countries?: string[];
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));

  let q = supabaseAdmin
    .from("calendar_events")
    .select("*", { count: "exact" })
    .gte("occurs_at", opts.startISO)
    .lte("occurs_at", opts.endISO);

  if (opts.countries?.length) {
    q = q.in("country", opts.countries.map((c) => c.toUpperCase()));
  }

  q = q.order("occurs_at", { ascending: true }).range(
    (page - 1) * pageSize,
    page * pageSize - 1
  );

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);

  return {
    page,
    pageSize,
    total: count ?? 0,
    items: (data ?? []) as CalendarEventRow[],
  };
}
