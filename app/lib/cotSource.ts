// lib/cotSource.ts
type Raw = Record<string, string | number | null>;
export type CotPoint = {
  date: string;
  market: string;
  noncomm_long: number;
  noncomm_short: number;
  net: number;
};

const toNum = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Matches dataset 9qbp-8g3m (Legacy - Financial Futures)
 * Fields used:
 *  - report_date_as_yyyy_mm_dd
 *  - market_and_exchange_names
 *  - noncomm_positions_long_all
 *  - noncomm_positions_short_all
 */
export async function fetchCOTFromSocrata(
  opts?: { since?: string; limit?: number; market?: string }
): Promise<CotPoint[]> {
  const base = process.env.CFTC_URL!;
  const limit = opts?.limit ?? 5000;
  const since = opts?.since ?? "2022-01-01";

  const select = [
    "report_date_as_yyyy_mm_dd",
    "market_and_exchange_names",
    "noncomm_positions_long_all",
    "noncomm_positions_short_all",
  ].join(",");

  const where = [
    `report_date_as_yyyy_mm_dd >= '${since}'`,
    opts?.market ? `market_and_exchange_names = '${opts.market}'` : null,
  ]
    .filter(Boolean)
    .join(" AND ");

  const params = new URLSearchParams({
    $select: select,
    $where: where,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: String(limit),
  });

  const res = await fetch(`${base}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`CFTC fetch failed: ${res.status} ${res.statusText}`);

  const rows = (await res.json()) as Raw[];

  const out = rows.map((r) => {
    const date = String(r["report_date_as_yyyy_mm_dd"]);
    const market = String(r["market_and_exchange_names"]);
    const longN = toNum(r["noncomm_positions_long_all"]);
    const shortN = toNum(r["noncomm_positions_short_all"]);
    return { date, market, noncomm_long: longN, noncomm_short: shortN, net: longN - shortN };
  });

  return out.reverse(); // ascending for charts
}
