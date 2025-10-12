import { CBANKS, DEFAULT_CODES, LiveRate } from "../cbanks";

// Shape of the Myfxbook economic calendar entries we care about
type MyfxbookEvent = {
  country?: string;
  title?: string;
  date?: string;
  actual?: unknown;
  previous?: unknown;
  forecast?: unknown;
};

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const isRateEventTitle = (title: string) =>
  /interest rate|rate decision|cash rate|bank rate|policy rate|refinancing/i.test(title || "");

export async function fetchMyfxbookWindow(fromISO: string, toISO: string): Promise<MyfxbookEvent[]> {
  const url = `https://www.myfxbook.com/api/get-economic-calendar.json?from=${fromISO}&to=${toISO}`;
  const res = await fetch(url, { next: { revalidate: 60 } }); // cache ~60s
  if (!res.ok) throw new Error(`Myfxbook HTTP ${res.status}`);

  const json = (await res.json().catch(() => ({}))) as unknown;
  if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as Record<string, unknown>).economicCalendar)
  ) {
    return (json as { economicCalendar: MyfxbookEvent[] }).economicCalendar;
  }

  return [];
}

export function extractMyfxbookRates(
  raw: readonly MyfxbookEvent[],
  includeCodes: readonly string[] = DEFAULT_CODES
): LiveRate[] {
  const out: LiveRate[] = [];
  for (const ev of raw) {
    const cc = String(ev.country || "").toUpperCase();
    const title = String(ev.title || "");
    if (!isRateEventTitle(title)) continue;

    const code = includeCodes.find((k) => CBANKS[k].myfxCountry.includes(cc));
    if (!code) continue;
    const meta = CBANKS[code];

    out.push({
      cb_code: meta.cb_code,
      country: meta.country,
      currency: meta.currency,
      current: toNum(ev.actual),
      previous: toNum(ev.previous),
      forecast: toNum(ev.forecast),
      released_at: ev.date ? new Date(ev.date).toISOString() : null,
      next_meeting: null,
      source: "myfxbook",
    });
  }
  return dedupeKeepLatest(out);
}

function dedupeKeepLatest(list: LiveRate[]): LiveRate[] {
  const m = new Map<string, LiveRate>();
  for (const r of list) {
    const prev = m.get(r.cb_code);
    if (!prev) {
      m.set(r.cb_code, r);
      continue;
    }
    const ta = prev.released_at ? Date.parse(prev.released_at) : 0;
    const tb = r.released_at ? Date.parse(r.released_at) : 0;
    if (tb >= ta) m.set(r.cb_code, r);
  }
  return [...m.values()];
}
