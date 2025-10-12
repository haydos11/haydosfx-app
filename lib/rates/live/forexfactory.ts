import { CBANKS, DEFAULT_CODES, LiveRate } from "../cbanks";

// Minimal shape of a ForexFactory calendar item we actually use
type FFEvent = {
  title?: string;
  country?: string;         // e.g., "United States"
  country_code?: string;    // e.g., "US"
  timestamp?: number | string; // unix seconds (often number, sometimes stringy)
  date?: string;            // ISO-ish fallback
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

export async function fetchForexFactoryThisWeek(): Promise<FFEvent[] | null> {
  const urls = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json",
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { next: { revalidate: 60 } });
      if (!r.ok) continue;
      const j = (await r.json().catch(() => null)) as unknown;
      if (Array.isArray(j)) return j as FFEvent[];
    } catch {
      // ignore and try next url
    }
  }
  return null;
}

export function extractForexFactoryRates(
  json: unknown,
  includeCodes: readonly string[] = DEFAULT_CODES
): LiveRate[] {
  if (!Array.isArray(json)) return [];
  const items = json as FFEvent[];
  const out: LiveRate[] = [];

  for (const ev of items) {
    const title = `${ev.title || ""}`.trim();
    if (!isRateEventTitle(title)) continue;

    const cc = String(ev.country || ev.country_code || "").toUpperCase();
    const code = includeCodes.find((k) => CBANKS[k].ffCountry.includes(cc));
    if (!code) continue;
    const meta = CBANKS[code];

    // FF often has unix timestamp (seconds)
    const releasedISO =
      ev?.timestamp != null
        ? new Date(Number(ev.timestamp) * 1000).toISOString()
        : ev?.date
        ? new Date(ev.date).toISOString()
        : null;

    out.push({
      cb_code: meta.cb_code,
      country: meta.country,
      currency: meta.currency,
      current: toNum(ev.actual),
      previous: toNum(ev.previous),
      forecast: toNum(ev.forecast),
      released_at: releasedISO,
      next_meeting: null,
      source: "forexfactory",
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
