// lib/economy/transform.ts
import type { Transform } from "./series";

type Pt = { date: string; value: number };

// Format YYYY-MM-DD safely in UTC
function toISODateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${y}-${mm}-${dd}`;
}

// Move any YYYY-MM-?? input to the last calendar day of that month (UTC)
function monthEndDate(iso: string): string {
  // force UTC to avoid TZ shifts
  const d = new Date(`${iso}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based
  const last = new Date(Date.UTC(y, m + 1, 0)); // day 0 of next month = last day of this month
  return toISODateUTC(last);
}

export function transformSeries(values: Pt[], t?: Transform): Pt[] {
  if (!t || t === "none") return values;

  // Ensure ascending by date (ISO yyyy-mm-dd sorts lexicographically)
  const sorted = [...values].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const map = new Map(sorted.map((v) => [v.date, v.value]));

  const laggedDate = (date: string, t: Transform) => {
    const d = new Date(`${date}T00:00:00Z`); // pin to UTC
    if (t === "mom" || t === "diff") d.setUTCMonth(d.getUTCMonth() - 1);
    if (t === "yoy") d.setUTCFullYear(d.getUTCFullYear() - 1);
    return toISODateUTC(d);
  };

  const pct = (a: number, b: number) => ((a - b) / Math.abs(b)) * 100;

  const out: Pt[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const { date, value } = sorted[i];
    const targetLag = laggedDate(date, t);
    let prev = map.get(targetLag);

    // Fallback by index if exact lag date not found (common with monthly)
    if (prev === undefined) {
      if (t === "mom" || t === "diff") {
        const j = i - 1;
        if (j >= 0) prev = sorted[j].value;
      } else if (t === "yoy") {
        const j = i - 12;
        if (j >= 0) prev = sorted[j].value;
      }
    }

    if (prev !== undefined && Number.isFinite(prev) && Number.isFinite(value)) {
      const outDate = monthEndDate(date); // normalize to last day of month

      if (t === "diff") {
        // PAYEMS (and similar CES/FRED level series) are in THOUSANDS.
        // Return the headline change in FULL PERSONS so axes can show "k".
        const deltaThousands = value - prev;
        out.push({ date: outDate, value: deltaThousands * 1000 });
      } else {
        out.push({ date: outDate, value: pct(value, prev) });
      }
    }
  }

  return out;
}
