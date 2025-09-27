"use client";
import { useEffect, useState } from "react";
import type { CalendarEventRow } from "../types";

type Params = { start: string; end: string; country?: string; page?: number; pageSize?: number; };

export function useCalendar(params: Params) {
  const [data, setData] = useState<{items: CalendarEventRow[]; total: number; page: number; pageSize: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);

    const qs = new URLSearchParams({
      start: params.start, end: params.end,
      ...(params.country ? { country: params.country } : {}),
      ...(params.page ? { page: String(params.page) } : {}),
      ...(params.pageSize ? { pageSize: String(params.pageSize) } : {}),
    });

    fetch(`/api/calendar/query?${qs.toString()}`, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error(`query failed: ${r.status}`);
        return r.json();
      })
      .then(json => { if (!cancelled) setData(json); })
      .catch(e => { if (!cancelled) setError(e.message ?? "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [params.start, params.end, params.country, params.page, params.pageSize]);

  return { data, loading, error };
}
