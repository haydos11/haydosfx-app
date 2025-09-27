import type { CotRow, CotSeries, MarketDef } from "./shape";

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const PAGE = 50_000;

type SocrataRow = {
  report_date_as_yyyy_mm_dd?: string; // "YYYY-MM-DDT00:00:00.000"
  market_and_exchange_names?: string;
  // Non-commercial (large specs)
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
  // Commercials
  comm_positions_long_all?: string | number;
  comm_positions_short_all?: string | number;
  // Nonreportable (small traders)
  nonrept_positions_long_all?: string | number;
  nonrept_positions_short_all?: string | number;
  // Open interest
  open_interest_all?: string | number | null;
};

function qs(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCotSeries({
  startDate,
  markets,
  recentWeeks = 12,
}: {
  startDate: string | null;
  markets: MarketDef[];
  recentWeeks?: number;
}): Promise<CotSeries[]> {
  if (!markets.length) return [];

  const marketsIn = markets.map(m => `'${m.socrataKey.replace(/'/g, "''")}'`).join(", ");
  const where = [
    `market_and_exchange_names in (${marketsIn})`,
    ...(startDate ? [`report_date_as_yyyy_mm_dd >= '${startDate}'`] : []),
  ].join(" AND ");

  const select = [
    "report_date_as_yyyy_mm_dd",
    "market_and_exchange_names",
    "noncomm_positions_long_all",
    "noncomm_positions_short_all",
    "comm_positions_long_all",
    "comm_positions_short_all",
    "nonrept_positions_long_all",
    "nonrept_positions_short_all",
    "open_interest_all",
  ].join(",");

  const order = "report_date_as_yyyy_mm_dd DESC, market_and_exchange_names ASC";

  let all: SocrataRow[] = [];
  let offset = 0;

  while (true) {
    const url = `${CFTC_URL}?${qs({ $select: select, $where: where, $order: order, $limit: PAGE, $offset: offset })}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CFTC fetch failed (${res.status})`);
    const batch = (await res.json()) as SocrataRow[];
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  // Group by market
  const byMarket = new Map<string, SocrataRow[]>();
  for (const row of all) {
    const k = row.market_and_exchange_names || "unknown";
    if (!byMarket.has(k)) byMarket.set(k, []);
    byMarket.get(k)!.push(row);
  }

  // Build CotSeries per selected market, sorted ASC by date
  const nowIso = new Date().toISOString();

  const out: CotSeries[] = markets.map(m => {
    const rows = (byMarket.get(m.socrataKey) || []).slice().sort((a, b) => {
      const da = (a.report_date_as_yyyy_mm_dd || "").slice(0, 10);
      const db = (b.report_date_as_yyyy_mm_dd || "").slice(0, 10);
      return da < db ? -1 : da > db ? 1 : 0;
    });

    const dates: string[] = [];
    const large: number[] = [];
    const small: number[] = [];
    const comm: number[] = [];
    const ls_large: number[] = [];
    const ls_small: number[] = [];
    const ls_comm: number[] = [];
    const open_interest: (number | null)[] = [];

    const recentRows: CotRow[] = [];

    let prevL: number | null = null;
    let prevS: number | null = null;
    let prevC: number | null = null;
    let prevOI: number | null = null;

    for (const r of rows) {
      const d = (r.report_date_as_yyyy_mm_dd || "").slice(0, 10);

      // longs / shorts (nullable)
      const ncl = toNum(r.noncomm_positions_long_all);
      const ncs = toNum(r.noncomm_positions_short_all);
      const cml = toNum(r.comm_positions_long_all);
      const cms = toNum(r.comm_positions_short_all);
      const nrl = toNum(r.nonrept_positions_long_all);
      const nrs = toNum(r.nonrept_positions_short_all);
      const oi  = toNum(r.open_interest_all);

      // nets
      const L = (ncl ?? 0) - (ncs ?? 0);
      const C = (cml ?? 0) - (cms ?? 0);
      const S = (nrl ?? 0) - (nrs ?? 0);

      // ratios (long/short), fill with NaN if missing to match your shape (you can ignore in UI)
      const rL = ncl !== null && ncs !== null && ncs !== 0 ? (Number(ncl) / Number(ncs)) : NaN;
      const rC = cml !== null && cms !== null && cms !== 0 ? (Number(cml) / Number(cms)) : NaN;
      const rS = nrl !== null && nrs !== null && nrs !== 0 ? (Number(nrl) / Number(nrs)) : NaN;

      dates.push(d);
      large.push(L);
      small.push(S);
      comm.push(C);
      ls_large.push(rL);
      ls_small.push(rS);
      ls_comm.push(rC);
      open_interest.push(oi);

      // recent table row (diffs)
      const row: CotRow = {
        date: d,
        large_spec_net: L,
        small_traders_net: S,
        commercials_net: C,
        open_interest: oi,
        d_large: prevL === null ? undefined : L - prevL,
        d_small: prevS === null ? undefined : S - prevS,
        d_comm:  prevC === null ? undefined : C - prevC,
        d_oi:    prevOI === null || oi === null ? undefined : oi - prevOI,
      };
      prevL = L; prevS = S; prevC = C; prevOI = oi ?? prevOI;
      recentRows.push(row);
    }

    // Keep only last N for the table
    const recent = recentRows.slice(-Math.max(4, Math.min(26, recentWeeks))).reverse(); // newest first in table

    const series: CotSeries = {
      market: { key: m.id, code: m.code, name: m.name },
      dates,
      large,
      small,
      comm,
      ls_large,
      ls_small,
      ls_comm,
      open_interest,
      recent,
      updated: nowIso,
    };
    return series;
  });

  return out;
}
