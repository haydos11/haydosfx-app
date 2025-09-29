"use client";
import { useEffect, useState } from "react";
import type { CalendarEventRow } from "../types";
import { supabase } from "@/lib/db/supabase-clients";

type Params = {
  start: string;            // yyyy-mm-dd
  end: string;              // yyyy-mm-dd
  country?: string;         // "US,GB,EU"
  page?: number;
  pageSize?: number;
};

// Row shape produced by the SELECT (matches your aliases)
type ResultRow = {
  id: number;
  country: string;                 // alias of country_code
  title: string;                   // alias of event_name
  event_code: number;              // alias of event_id (number from DB)
  occurs_at: string;               // alias of release_time_utc (ISO)
  importance: number;              // alias of impact_enum
  actual: number | null;           // alias of actual_scaled
  forecast: number | null;         // alias of forecast_scaled
  previous: number | null;         // alias of previous_scaled
  unit: string | null;             // alias of unit_text
};

export function useCalendar(params: Params) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

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

        let q = supabase
          .from("calendar_values_human")
          .select(
            `
              id,
              country:country_code,
              title:event_name,
              event_code:event_id,
              occurs_at:release_time_utc,
              importance:impact_enum,
              actual:actual_scaled,
              forecast:forecast_scaled,
              previous:previous_scaled,
              unit:unit_text
            `,
            { count: "exact" }
          )
          .gte("release_time_utc", `${params.start}T00:00:00Z`)
          .lt("release_time_utc", `${params.end}T23:59:59Z`)
          .order("release_time_utc", { ascending: false })
          .range(from, to);

        const countries = (params.country ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (countries.length) q = q.in("country_code", countries);

        const { data: rows, count, error } = await q.returns<ResultRow[]>();
        if (error) throw new Error(error.message);

        // Map DB row -> UI row; coerce types as needed
        const items: CalendarEventRow[] = (rows ?? []).map((r) => ({
          ...r,
          event_code: String(r.event_code),          // <- fix: number -> string
          created_at: r.occurs_at ?? new Date().toISOString(),
          updated_at: r.occurs_at ?? new Date().toISOString(),
        }));

        if (!cancelled) {
          setData({
            items,
            total: count ?? 0,
            page,
            pageSize,
          });
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
  }, [params.start, params.end, params.country, page, pageSize, from, to]);

  return { data, loading, error };
}
