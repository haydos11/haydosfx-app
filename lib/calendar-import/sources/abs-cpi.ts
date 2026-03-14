import type { CalendarValue } from "../types";
import { buildCalendarValue } from "../build-value";

const EVENT_IDS = {
  cpiMom: 36010014,
  cpiYy: 36010015,
  cpiIndex: 36010018,
} as const;

const URLS = {
  cpiYy:
    "https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/3.10001.10.50.M?format=jsondata&lastNObservations=4",
  cpiIndex:
    "https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/1.10001.10.50.M?format=jsondata&lastNObservations=4",
  cpiMom:
    "https://data.api.abs.gov.au/rest/data/ABS,CPI,2.0.0/2.10001.10.50.M?format=jsondata&lastNObservations=4",
} as const;

/**
 * Map ABS reference month -> actual release timestamp used by your calendar.
 * Extend this each month as new releases come out.
 */
const RELEASE_BY_PERIOD: Record<string, string> = {
  "2025-10": "2025-11-26T01:30:00Z",
  "2025-11": "2026-01-07T01:30:00Z",
  "2025-12": "2026-01-28T01:30:00Z",
  "2026-01": "2026-02-25T01:30:00Z",
};

type AbsObservationMap = Record<string, [number | null, unknown?, unknown?, unknown?]>;

type AbsJson = {
  data?: {
    dataSets?: Array<{
      series?: Record<string, { observations?: AbsObservationMap }>;
    }>;
    structures?: Array<{
      dimensions?: {
        observation?: Array<{
          values?: Array<{
            id?: string;
            start?: string;
            end?: string;
          }>;
        }>;
      };
    }>;
  };
};

type SeriesPoint = {
  periodId: string;
  periodStart: string;
  value: number | null;
};

function releaseDateForPeriod(periodId: string): string | null {
  return RELEASE_BY_PERIOD[periodId] ?? null;
}

function makeReleaseBasedId(eventId: number, releaseDateIso: string): number {
  const d = new Date(releaseDateIso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return Number(`${eventId}${y}${m}${day}`);
}

function parseAbsSeries(json: AbsJson): SeriesPoint[] {
  const series = json.data?.dataSets?.[0]?.series;
  if (!series) throw new Error("ABS response missing series");

  const firstSeriesKey = Object.keys(series)[0];
  if (!firstSeriesKey) throw new Error("ABS response has no series key");

  const observations = series[firstSeriesKey]?.observations;
  if (!observations) throw new Error("ABS response missing observations");

  const observationValues =
    json.data?.structures?.[0]?.dimensions?.observation?.[0]?.values;

  if (!observationValues?.length) {
    throw new Error("ABS response missing observation dimension values");
  }

  return Object.entries(observations)
    .map(([obsIndex, obsTuple]) => {
      const dim = observationValues[Number(obsIndex)];
      if (!dim?.id || !dim?.start) return null;

      return {
        periodId: dim.id,
        periodStart: dim.start,
        value: obsTuple?.[0] ?? null,
      };
    })
    .filter((x): x is SeriesPoint => x !== null)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

async function fetchJson(url: string): Promise<AbsJson | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.sdmx.data+json" },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as AbsJson;
}

function buildRowsFromSeries(args: {
  eventId: number;
  impactType: number;
  series: SeriesPoint[];
}): CalendarValue[] {
  const rows: CalendarValue[] = [];

  for (let i = 0; i < args.series.length; i += 1) {
    const point = args.series[i];
    const releaseDate = releaseDateForPeriod(point.periodId);

    // Skip anything we don't yet have a proper release timestamp for.
    if (!releaseDate) continue;

    const previous = i > 0 ? args.series[i - 1]?.value ?? null : null;

    rows.push(
      buildCalendarValue({
        id: makeReleaseBasedId(args.eventId, releaseDate),
        eventId: args.eventId,
        releaseDate,
        periodDate: point.periodStart,
        revision: 0,
        impactType: args.impactType,
        actual: point.value,
        previous,
        revisedPrevious: null,
        forecast: null,
      })
    );
  }

  return rows;
}

export async function fetchAbsCpiValues(): Promise<CalendarValue[]> {
  const [yyJson, indexJson, momJson] = await Promise.all([
    fetchJson(URLS.cpiYy),
    fetchJson(URLS.cpiIndex),
    fetchJson(URLS.cpiMom),
  ]);

  const rows: CalendarValue[] = [];

  if (yyJson) {
    const yySeries = parseAbsSeries(yyJson);
    rows.push(
      ...buildRowsFromSeries({
        eventId: EVENT_IDS.cpiYy,
        impactType: 1,
        series: yySeries,
      })
    );
  }

  if (indexJson) {
    const indexSeries = parseAbsSeries(indexJson);
    rows.push(
      ...buildRowsFromSeries({
        eventId: EVENT_IDS.cpiIndex,
        impactType: 0,
        series: indexSeries,
      })
    );
  }

  if (momJson) {
    const momSeries = parseAbsSeries(momJson);
    rows.push(
      ...buildRowsFromSeries({
        eventId: EVENT_IDS.cpiMom,
        impactType: 1,
        series: momSeries,
      })
    );
  }

  return rows;
}