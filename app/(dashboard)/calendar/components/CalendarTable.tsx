"use client";
import type { CalendarEventRow } from "../types";

type Props = {
  items: CalendarEventRow[];
  loading?: boolean;
  error?: string | null;
};

export default function CalendarTable({ items, loading, error }: Props) {
  if (loading) {
    return (
      <div className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
        Loading calendar…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 rounded-lg border p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
        No events found for the selected range.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            <th>Date/Time (UTC)</th>
            <th>Country</th>
            <th>Title</th>
            <th>Imp</th>
            <th>Actual</th>
            <th>Forecast</th>
            <th>Previous</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-muted/10">
          {items.map((e) => (
            <tr key={e.id} className="[&>td]:px-3 [&>td]:py-2">
              <td className="whitespace-nowrap tabular-nums">
                {new Date(e.occurs_at).toISOString().replace("T", " ").slice(0, 16)}
              </td>
              <td className="font-medium">{e.country}</td>
              <td className="max-w-[32rem] truncate" title={e.title}>
                {e.title}
              </td>
              <td>{e.importance ?? ""}</td>
              <td>{e.actual ?? ""}</td>
              <td>{e.forecast ?? ""}</td>
              <td>{e.previous ?? ""}</td>
              <td>{e.unit ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
