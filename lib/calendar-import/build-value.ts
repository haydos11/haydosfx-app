import type { CalendarValue } from "./types";
import { encodeValue, toUnixSeconds } from "./encode";

export function buildCalendarValue(args: {
  id: number;
  eventId: number;
  releaseDate: string | Date;
  periodDate: string | Date;
  revision?: number;
  impactType?: number;
  actual?: number | null;
  previous?: number | null;
  revisedPrevious?: number | null;
  forecast?: number | null;
}): CalendarValue {
  return {
    id: args.id,
    event_id: args.eventId,
    time: toUnixSeconds(args.releaseDate),
    period: toUnixSeconds(args.periodDate),
    revision: args.revision ?? 0,
    impact_type: args.impactType ?? 0,
    actual_value: encodeValue(args.actual),
    prev_value: encodeValue(args.previous),
    revised_prev_value: encodeValue(args.revisedPrevious),
    forecast_value: encodeValue(args.forecast),
  };
}