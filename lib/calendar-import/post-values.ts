import type { CalendarValue } from "./types";

export async function postCalendarValues(values: CalendarValue[]) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const secret = process.env.CALENDAR_SECRET;

  if (!secret) {
    throw new Error("Missing CALENDAR_SECRET");
  }

  const res = await fetch(`${baseUrl}/api/calendar/values/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-calendar-secret": secret,
    },
    body: JSON.stringify({ values }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Values upsert failed (${res.status}): ${text}`);
  }

  return text;
}