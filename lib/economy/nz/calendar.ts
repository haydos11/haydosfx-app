// lib/economy/nz/calendar.ts

import type { EconomyError, EconomySeriesOut } from "@/lib/economy/types";
import {
  buildSeriesFromMatchedRows,
  fetchCalendarRowsForCountry,
  loadMultiplierMap,
} from "@/lib/economy/calendar/shared";
import { matchRowsToIndicator } from "@/lib/economy/uk/mapper";
import { NZ_CALENDAR_SETS } from "./definitions";

export async function getNzCalendarSeries(params: {
  start: string;
  setName?: string;
}): Promise<{
  series: EconomySeriesOut[];
  errors: EconomyError[];
}> {
  const { start, setName = "core" } = params;

  const defs = NZ_CALENDAR_SETS[setName];

  if (!defs) {
    throw new Error(`Unknown NZ set: ${setName}`);
  }

  const [multMap, rows] = await Promise.all([
    loadMultiplierMap(),
    fetchCalendarRowsForCountry(start, "NZ"),
  ]);

  const series: EconomySeriesOut[] = [];
  const errors: EconomyError[] = [];

  for (const def of defs) {
    try {
      const matchedRows = matchRowsToIndicator(rows, def);
      const built = buildSeriesFromMatchedRows(matchedRows, def, multMap);

      if (built) series.push(built);
    } catch (err) {
      errors.push({
        id: def.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { series, errors };
}