// lib/economy/uk/mapper.ts

import type { CalendarIndicatorDef } from "@/lib/economy/types";
import { first, normalizeLabel, type CalendarRawRow } from "@/lib/economy/calendar/shared";

function normalizeList(values?: string[]): string[] {
  return (values ?? []).map(normalizeLabel);
}

export function matchRowsToIndicator(
  rows: CalendarRawRow[],
  def: CalendarIndicatorDef
): CalendarRawRow[] {
  const exactNames = normalizeList(def.exactNames);
  const aliases = normalizeList(def.aliases);

  const exactMatches = rows.filter((row) => {
    const ev = first(row.event);
    const eventName = normalizeLabel(String(ev?.name ?? ""));
    return exactNames.includes(eventName);
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return rows.filter((row) => {
    const ev = first(row.event);
    const eventName = normalizeLabel(String(ev?.name ?? ""));
    return aliases.some((alias) => eventName.includes(alias));
  });
}