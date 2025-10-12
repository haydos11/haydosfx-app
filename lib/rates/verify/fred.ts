// FRED verification for US + ECB (daily official series)
// Get a free FRED key: https://fred.stlouisfed.org/docs/api/api_key.html

type FredObs = { date: string; value: string };

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function fredSeries(id: string, apiKey?: string) {
  const key = apiKey || process.env.FRED_API_KEY || "";
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&file_type=json&observation_start=2000-01-01${
    key ? `&api_key=${key}` : ""
  }`;

  const r = await fetch(url, { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);

  const j = (await r.json().catch(() => null)) as
    | { observations?: FredObs[] }
    | null;
  const obs: FredObs[] = j?.observations ?? [];
  const last = obs[obs.length - 1];
  const date = last?.date;
  const val = last?.value;
  return { date: date || null, value: val === "." ? null : toNum(val) };
}

/** Returns verified { cb_code, rate, effective_date, source } for selected banks */
export async function fetchVerifiedOfficial(
  codes: string[]
): Promise<
  Array<{
    cb_code: string;
    rate: number | null;
    effective_date: string | null;
    source: string;
  }>
> {
  const out: Array<{
    cb_code: string;
    rate: number | null;
    effective_date: string | null;
    source: string;
  }> = [];

  for (const code of codes) {
    if (code === "US") {
      // midpoint of the Fed target range
      const [u, l] = await Promise.all([fredSeries("DFEDTARU"), fredSeries("DFEDTARL")]);
      const rate =
        u.value != null && l.value != null
          ? (u.value + l.value) / 2
          : u.value ?? l.value ?? null;
      out.push({
        cb_code: "FED",
        rate,
        effective_date: u.date || l.date || null,
        source: "fred",
      });
    } else if (code === "EU") {
      // ECB Deposit Facility Rate (alt: ECBMRRFR for MRO)
      const dfr = await fredSeries("ECBDFR");
      out.push({
        cb_code: "ECB",
        rate: dfr.value,
        effective_date: dfr.date || null,
        source: "fred",
      });
    } else {
      // Others to be filled by BIS/NCB adapters later
      out.push({
        cb_code: codeToCb(code),
        rate: null,
        effective_date: null,
        source: "bis",
      });
    }
  }
  return out;
}

function codeToCb(code: string): string {
  switch (code) {
    case "GB":
      return "BOE";
    case "JP":
      return "BOJ";
    case "CH":
      return "SNB";
    case "CA":
      return "BOC";
    case "AU":
      return "RBA";
    case "NZ":
      return "RBNZ";
    case "CN":
      return "PBOC";
    case "EU":
      return "ECB";
    case "US":
      return "FED";
    default:
      return code;
  }
}
