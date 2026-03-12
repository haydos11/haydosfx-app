// lib/economy/uk/calendar.ts

import type { EconomyError, EconomySeriesOut } from "@/lib/economy/types";
import {
  buildSeriesFromMatchedRows,
  fetchCalendarRowsForCountry,
  loadMultiplierMap,
} from "@/lib/economy/calendar/shared";
import { UK_CALENDAR_SETS } from "./definitions";
import { matchRowsToIndicator } from "./mapper";

export async function getUkCalendarSeries(params: {
  start: string;
  setName?: string;
}): Promise<{
  series: EconomySeriesOut[];
  errors: EconomyError[];
}> {
  const { start, setName = "core" } = params;
  const defs = UK_CALENDAR_SETS[setName];

  if (!defs) {
    throw new Error(`Unknown UK set: ${setName}`);
  }

  const [multMap, gbRows] = await Promise.all([
    loadMultiplierMap(),
    fetchCalendarRowsForCountry(start, "GB"),
  ]);

  const series: EconomySeriesOut[] = [];
  const errors: EconomyError[] = [];

  for (const def of defs) {
    try {
      const matchedRows = matchRowsToIndicator(gbRows, def);
      const built = buildSeriesFromMatchedRows(matchedRows, def, multMap);

      if (built) {
        series.push(built);
      }
    } catch (err) {
      errors.push({
        id: def.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { series, errors };
}