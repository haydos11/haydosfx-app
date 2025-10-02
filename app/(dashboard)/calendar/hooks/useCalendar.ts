// app/(dashboard)/calendar/hooks/useCalendar.ts
"use client";
import { useEffect, useMemo, useState } from "react";
import type { CalendarEventRow } from "../types";
import { supabase } from "@/lib/db/supabase-clients";

/* =========================================================
   Shared types (used by the drawer)
========================================================= */
export type EventCore = {
  event_id: number;
  event_code?: string | number | null;
  event_name: string;
  country_code: string;
  currency_code?: string | null;
  sector_text?: string | null;
  importance_enum?: number | null;
  unit_text?: string | null;
  source_url?: string | null;
};

export type EventPoint = {
  id: number;
  event_id: number;
  release_time_utc: string; // ISO
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
  country?: string;         // "US,GB | sector=Prices | impact=2,3" or text forms
  page?: number;
  pageSize?: number;
};

type ResultRow = {
  id: number;
  country: string;           // alias of country_code
  title: string;             // alias of event_name
  event_code: number;        // alias of event_id (in your view)
  occurs_at: string;         // alias of release_time_utc
  importance: number;        // alias of importance_enum
  actual: number | null;     // alias of actual_scaled
  forecast: number | null;   // alias of forecast_scaled
  previous: number | null;   // alias of previous_scaled
  unit: string | null;       // alias of unit_text
};

/* ------------------- helpers ------------------- */
const aliasCountry = (cc: string) => {
  const m = cc.trim().toUpperCase();
  if (!m) return "";
  if (m === "UK") return "GB";
  if (m === "EA") return "EU";
  return m;
};

const ENUM_TO_TEXT: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Moderate",
  3: "High",
};
const TEXT_TO_ENUM: Record<string, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/** Accepts strings like:
 *  "US,GB,EU | sector=Prices,Jobs | impact=2,3"
 *  or "US,GB | sector=GDP | impact=High,Moderate"
 */
function parseFilters(encoded?: string) {
  const out = {
    countries: [] as string[],
    sectors: [] as string[],         // sector_text values
    impactEnums: [] as number[],     // 1/2/3 (exclude 0 unless explicitly chosen)
    impactTexts: [] as string[],     // "Low"/"Moderate"/"High"
  };
  if (!encoded || !encoded.trim()) return out;

  const parts = encoded.split("|").map((s) => s.trim()).filter(Boolean);

  // pull k=v segments
  const getVal = (k: string) =>
    parts
      .find((p) => new RegExp(`^${k}\\s*=`, "i").test(p))
      ?.split("=")[1]
      ?.trim();

  const sectorsPart = getVal("sector");
  const impactPart = getVal("impact");

  if (sectorsPart) {
    out.sectors = sectorsPart.split(",").map((s) => s.trim()).filter(Boolean);
  }

  if (impactPart) {
    const tokens = impactPart.split(",").map((s) => s.trim()).filter(Boolean);
    for (const t of tokens) {
      const n = Number(t);
      if (Number.isFinite(n)) {
        if (n >= 0 && n <= 3) out.impactEnums.push(n);
      } else {
        const e = TEXT_TO_ENUM[t.toLowerCase()];
        if (e != null) {
          out.impactEnums.push(e);
          out.impactTexts.push(ENUM_TO_TEXT[e]);
        } else {
          out.impactTexts.push(t);
        }
      }
    }
    out.impactEnums = Array.from(new Set(out.impactEnums));
    out.impactTexts = Array.from(new Set(out.impactTexts));
  }

  // countries = everything else once k=v parts are stripped
  const countryPart = encoded
    .replace(/(?:^|\|)\s*sector=[^|]*/gi, "")
    .replace(/(?:^|\|)\s*impact=[^|]*/gi, "")
    .replace(/\|/g, "")
    .trim();

  if (countryPart) {
    out.countries = countryPart
      .split(",")
      .map(aliasCountry)
      .filter(Boolean);
  }
  out.countries = Array.from(new Set(out.countries));

  // Exclude None unless explicitly chosen
  out.impactEnums = out.impactEnums.filter((n) => n !== 0);

  return out;
}

function endExclusiveISO(end: string) {
  const d = new Date(`${end}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ------------------- useCalendar (list) ------------------- */
export function useCalendar(params: Params) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const parsed = useMemo(() => parseFilters(params.country), [params.country]);
  const { countries, sectors, impactEnums, impactTexts } = parsed;

  const [data, setData] = useState<{
    items: CalendarEventRow[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        if (!params.start || !params.end) throw new Error("missing start/end");
        const endX = endExclusiveISO(params.end);

        let q = supabase
          .from("calendar_values_human")
          .select(
            `
              id,
              country:country_code,
              title:event_name,
              event_code:event_id,
              occurs_at:release_time_utc,
              importance:importance_enum,
              actual:actual_scaled,
              forecast:forecast_scaled,
              previous:previous_scaled,
              unit:unit_text
            `,
            { count: "exact" }
          )
          .gte("release_time_utc", `${params.start}T00:00:00Z`)
          .lt("release_time_utc", `${endX}T00:00:00Z`)
          .order("release_time_utc", { ascending: false })
          .range(from, to);

        // Countries -> country_code
        if (countries.length) q = q.in("country_code", countries);
        // Sector -> sector_text
        if (sectors.length) q = q.in("sector_text", sectors);
        // Impact -> enum preferred; fallback text
        if (impactEnums.length) q = q.in("importance_enum", impactEnums);
        else if (impactTexts.length) q = q.in("importance_text", impactTexts);

        const { data: rows, count, error } = await q.returns<ResultRow[]>();
        if (error) throw new Error(error.message);

        const items: CalendarEventRow[] = (rows ?? []).map((r) => ({
          ...r,
          event_code: String(r.event_code), // keep as string for UI safety
          created_at: r.occurs_at ?? new Date().toISOString(),
          updated_at: r.occurs_at ?? new Date().toISOString(),
        }));

        if (!cancelled) {
          setData({ items, total: count ?? 0, page, pageSize });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    // primitives
    params.start,
    params.end,
    page,
    pageSize,
    from,
    to,
    // arrays actually read inside the effect
    countries,
    sectors,
    impactEnums,
    impactTexts,
  ]);

  return { data, loading, error };
}

/* =========================================================
   useCalendarEvent(eventIdOrCode) — powers the side drawer
========================================================= */
type EventsTableRow = {
  id: number;
  event_code?: string | number | null;
  title: string;
  country_id: number | null;
  sector_text?: string | null;
  importance_enum?: number | null;
  unit_text?: string | null;
  source_url?: string | null;
};

type CountryTableRow = {
  code: string | null;
  currency_code: string | null;
};

type ValuesHumanRow = {
  id: number;
  event_id: number;
  release_time_utc: string | number | Date;
  actual_scaled: number | null;
  forecast_scaled: number | null;
  previous_scaled: number | null;
  revised_prev_value: number | null;
  unit_text: string | null;
};

export function useCalendarEvent(eventId: number | string | null) {
  const [data, setData] = useState<EventPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    async function run() {
      if (eventId == null || eventId === "") return;
      setLoading(true);
      setError(null);

      try {
        const idNum = Number(eventId);
        const looksNumeric = Number.isFinite(idNum);

        // ---- 1) Resolve core by id OR by event_code (SINGLE ROW) ----
        let ev: EventsTableRow | null = null;

        if (looksNumeric) {
          const r1 = await supabase
            .from("calendar_events")
            .select(
              `
                id,
                event_code,
                title,
                country_id,
                sector_text,
                importance_enum,
                unit_text,
                source_url
              `
            )
            .eq("id", idNum)
            .maybeSingle();
          if (r1.error) throw new Error(r1.error.message);
          ev = (r1.data as EventsTableRow) ?? null;
        }

        if (!ev) {
          const r2 = await supabase
            .from("calendar_events")
            .select(
              `
                id,
                event_code,
                title,
                country_id,
                sector_text,
                importance_enum,
                unit_text,
                source_url
              `
            )
            .eq("event_code", looksNumeric ? idNum : String(eventId))
            .maybeSingle();
          if (r2.error) throw new Error(r2.error.message);
          ev = (r2.data as EventsTableRow) ?? ev;
        }

        if (!ev) throw new Error("Event not found");

        // ---- 1b) Country info (SINGLE ROW) ---------------------------
        let countryCode: string | undefined;
        let currencyCode: string | undefined;
        if (ev.country_id != null) {
          const c = await supabase
            .from("calendar_countries")
            .select(`code, currency_code`)
            .eq("id", ev.country_id)
            .maybeSingle();
          if (c.error) throw new Error(c.error.message);
          const crow = c.data as CountryTableRow | null;
          countryCode = crow?.code ?? undefined;
          currencyCode = crow?.currency_code ?? undefined;
        }

        const core: EventCore = {
          event_id: ev.id,
          event_code: ev.event_code ?? null,
          event_name: ev.title,
          country_code: countryCode ?? "—",
          currency_code: currencyCode ?? null,
          sector_text: ev.sector_text ?? null,
          importance_enum: ev.importance_enum ?? null,
          unit_text: ev.unit_text ?? null,
          source_url: ev.source_url ?? null,
        };

        // ---- 2) History from 'calendar_values_human' (ARRAY) ---------
        const vq = await supabase
          .from("calendar_values_human")
          .select(
            `
              id,
              event_id,
              release_time_utc,
              actual_scaled,
              forecast_scaled,
              previous_scaled,
              revised_prev_value,
              unit_text
            `
          )
          .eq("event_id", core.event_id)
          .order("release_time_utc", { ascending: false })
          .limit(200)
          .returns<ValuesHumanRow[]>();

        if (vq.error) throw new Error(vq.error.message);

        const history: EventPoint[] = (vq.data ?? []).map((v: ValuesHumanRow) => {
          let iso = "";
          if (typeof v.release_time_utc === "string") {
            iso = v.release_time_utc;
          } else if (v.release_time_utc instanceof Date) {
            iso = v.release_time_utc.toISOString();
          } else {
            const n = Number(v.release_time_utc);
            const ms = n < 1e12 ? n * 1000 : n;
            iso = new Date(ms).toISOString();
          }
          return {
            id: v.id,
            event_id: v.event_id,
            release_time_utc: iso,
            actual_value: v.actual_scaled,
            forecast_value: v.forecast_scaled,
            previous_value: v.previous_scaled,
            revised_prev_value: v.revised_prev_value,
            unit_text: v.unit_text ?? core.unit_text ?? null,
          };
        });

        const latest = history[0] ?? null;

        // ---- 3) Next scheduled time from raw table (SINGLE ROW) ------
        const isoNow = new Date().toISOString();
        const nextQ = await supabase
          .from("calendar_values")
          .select(`release_time_utc`)
          .eq("event_id", core.event_id)
          .gt("release_time_utc", isoNow)
          .order("release_time_utc", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextQ.error) throw new Error(nextQ.error.message);

        const payload: EventPayload = {
          core,
          latest,
          next_time_utc: (nextQ.data as { release_time_utc?: string } | null)?.release_time_utc ?? null,
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
    return () => {
      cancel = true;
    };
  }, [eventId]);

  return { data, loading, error };
}
