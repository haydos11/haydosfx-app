import type { EconomyError, EconomySeriesOut } from "@/lib/economy/types";
import {
  buildSeriesFromMatchedRows,
  fetchCalendarRowsForCountry,
  loadMultiplierMap,
} from "@/lib/economy/calendar/shared";
import { matchRowsToIndicator } from "@/lib/economy/uk/mapper";
import { JP_CALENDAR_SETS } from "./definitions";

export async function getJpCalendarSeries(params: {
  start: string;
  setName?: string;
}): Promise<{
  series: EconomySeriesOut[];
  errors: EconomyError[];
}> {
  const { start, setName = "core" } = params;
  const defs = JP_CALENDAR_SETS[setName];

  if (!defs) {
    throw new Error(`Unknown JP set: ${setName}`);
  }

  const [multMap, jpRows] = await Promise.all([
    loadMultiplierMap(),
    fetchCalendarRowsForCountry(start, "JP"),
  ]);

  const series: EconomySeriesOut[] = [];
  const errors: EconomyError[] = [];

  for (const def of defs) {
    try {
      const matchedRows = matchRowsToIndicator(jpRows, def);
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