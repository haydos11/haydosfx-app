"use client";

import { useMemo, useState } from "react";
import CalendarTable from "./components/CalendarTable";
import { useCalendar } from "./hooks/useCalendar";

function isoToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function isoAddDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function startOfWeekISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const diff = (d.getUTCDay() + 6) % 7; // Monday=0
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  // Defaults: this week (Mon→Sun)
  const defaultStart = useMemo(() => startOfWeekISO(), []);
  const defaultEnd = useMemo(() => isoAddDays(startOfWeekISO(), 6), []);

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [country, setCountry] = useState<string>(""); // e.g. "US,GB,EU"
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const { data, loading, error } = useCalendar({ start, end, country, page, pageSize });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Economic Calendar</h1>

      {/* Filters */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col">
          <label className="text-sm text-muted-foreground">Start</label>
          <input
            type="date"
            value={start}
            onChange={(e) => { setStart(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-muted-foreground">End</label>
          <input
            type="date"
            value={end}
            onChange={(e) => { setEnd(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm text-muted-foreground">Countries (comma-separated)</label>
          <input
            type="text"
            placeholder="US,GB,EU"
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={() => {
              const s = startOfWeekISO();
              setStart(s);
              setEnd(isoAddDays(s, 6));
              setPage(1);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            This Week
          </button>
          <button
            onClick={() => {
              const t = isoToday();
              setStart(t);
              setEnd(t);
              setPage(1);
            }}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Today
          </button>
        </div>
      </div>

      {/* Table */}
      <CalendarTable
        items={data?.items ?? []}
        loading={loading}
        error={error}
      />

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total ? `Total: ${total} • Page ${page}/${totalPages}` : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
