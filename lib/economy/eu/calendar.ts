// lib/economy/eu/calendar.ts

import type { EconomyError, EconomySeriesOut } from "@/lib/economy/types";
import {
  buildSeriesFromMatchedRows,
  fetchCalendarRowsForCountry,
  loadMultiplierMap,
} from "@/lib/economy/calendar/shared";
import { matchRowsToIndicator } from "@/lib/economy/uk/mapper";
import { EU_CALENDAR_SETS } from "./definitions";

export async function getEuCalendarSeries(params: {
  start: string;
  setName?: string;
}): Promise<{
  series: EconomySeriesOut[];
  errors: EconomyError[];
}> {
  const { start, setName = "core" } = params;
  const defs = EU_CALENDAR_SETS[setName];

  if (!defs) {
    throw new Error(`Unknown EU set: ${setName}`);
  }

  const [multMap, euRows] = await Promise.all([
    loadMultiplierMap(),
    fetchCalendarRowsForCountry(start, "EU"),
  ]);

  const series: EconomySeriesOut[] = [];
  const errors: EconomyError[] = [];

  for (const def of defs) {
    try {
      const matchedRows = matchRowsToIndicator(euRows, def);
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