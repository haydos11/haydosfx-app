import { MARKET_BY_CFTC } from "../markets";
import type { CotMarketMeta, CotReportRow, RawCotRow } from "./types";

function toNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctOfOi(net: number | null, oi: number | null): number | null {
  if (net === null || oi === null || oi === 0) return null;
  return (net / oi) * 100;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

const SOCRATA_KEY_ALIASES: Record<string, string> = {
  "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE":
    "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE",

  "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE":
    "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE",

  "BRENT LAST DAY - NEW YORK MERCANTILE EXCHANGE":
    "BRENT CRUDE OIL LAST DAY - NEW YORK MERCANTILE EXCHANGE",

  "CRUDE OIL, LIGHT SWEET-WTI - NEW YORK MERCANTILE EXCHANGE":
    "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",

  "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE":
    "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",

  "GASOLINE BLENDSTOCK (RBOB)  - NEW YORK MERCANTILE EXCHANGE":
    "GASOLINE BLENDSTOCK (RBOB) - NEW YORK MERCANTILE EXCHANGE",

  "GASOLINE RBOB - NEW YORK MERCANTILE EXCHANGE":
    "GASOLINE BLENDSTOCK (RBOB) - NEW YORK MERCANTILE EXCHANGE",

  "NAT GAS ICE LD1 - ICE FUTURES ENERGY DIV  ":
    "NAT GAS ICE LD1 - ICE FUTURES ENERGY DIV",

  "COPPER- #1 - COMMODITY EXCHANGE INC.":
    "COPPER-GRADE #1 - COMMODITY EXCHANGE INC.",
};

function canonicalizeKey(value: string): string {
  const normalized = normalizeKey(value);
  return SOCRATA_KEY_ALIASES[normalized] ?? normalized;
}

export function transformCotRows(
  rawRows: RawCotRow[],
  marketMetaRows: CotMarketMeta[]
): CotReportRow[] {
  const metaBySocrataKey = new Map<string, CotMarketMeta>();

  for (const meta of marketMetaRows) {
    if (meta.socrata_key) {
      metaBySocrataKey.set(canonicalizeKey(meta.socrata_key), meta);
    }
  }

  const registryByCftcKey = new Map<string, unknown>();
  for (const [key, value] of Object.entries(MARKET_BY_CFTC)) {
    registryByCftcKey.set(canonicalizeKey(key), value);
  }

  const transformed: CotReportRow[] = [];

  for (const row of rawRows) {
    const rawKey = row.market_and_exchange_names?.trim();
    if (!rawKey) continue;

    const socrataKey = canonicalizeKey(rawKey);

    const registryMarket = registryByCftcKey.get(socrataKey);
    const meta = metaBySocrataKey.get(socrataKey);

    if (!registryMarket || !meta) continue;

    const reportDate = (row.report_date_as_yyyy_mm_dd ?? "").slice(0, 10);
    if (!reportDate) continue;

    const longNonCommercial = toNum(row.noncomm_positions_long_all);
    const shortNonCommercial = toNum(row.noncomm_positions_short_all);
    const spreadNonCommercial = null;

    const longCommercial = toNum(row.comm_positions_long_all);
    const shortCommercial = toNum(row.comm_positions_short_all);

    const longNonReportable = toNum(row.nonrept_positions_long_all);
    const shortNonReportable = toNum(row.nonrept_positions_short_all);

    const oiTotal = toNum(row.open_interest_all);

    const netNonCommercial =
      longNonCommercial !== null && shortNonCommercial !== null
        ? longNonCommercial - shortNonCommercial
        : null;

    const netCommercial =
      longCommercial !== null && shortCommercial !== null
        ? longCommercial - shortCommercial
        : null;

    const netNonReportable =
      longNonReportable !== null && shortNonReportable !== null
        ? longNonReportable - shortNonReportable
        : null;

    const netNonCommercialPctOi = pctOfOi(netNonCommercial, oiTotal);
    const netCommercialPctOi = pctOfOi(netCommercial, oiTotal);
    const netNonReportablePctOi = pctOfOi(netNonReportable, oiTotal);

    const nativeNotional =
      netNonCommercial !== null
        ? netNonCommercial * meta.contract_size
        : null;

    const usdSignedExposure =
      nativeNotional !== null
        ? nativeNotional * meta.usd_direction_if_long
        : null;

    transformed.push({
      report_date: reportDate,
      market_code: meta.market_code,
      market_name: meta.market_name,
      socrata_key: rawKey,
      cftc_code: meta.cftc_code,
      category: meta.category,
      long_noncommercial: longNonCommercial,
      short_noncommercial: shortNonCommercial,
      spread_noncommercial: spreadNonCommercial,
      long_commercial: longCommercial,
      short_commercial: shortCommercial,
      long_nonreportable: longNonReportable,
      short_nonreportable: shortNonReportable,
      oi_total: oiTotal,
      net_noncommercial: netNonCommercial,
      net_commercial: netCommercial,
      net_nonreportable: netNonReportable,
      net_noncommercial_pct_oi: netNonCommercialPctOi,
      net_commercial_pct_oi: netCommercialPctOi,
      net_nonreportable_pct_oi: netNonReportablePctOi,
      native_notional: nativeNotional,
      usd_signed_exposure: usdSignedExposure,
      raw_json: row,
    });
  }

  return transformed;
}