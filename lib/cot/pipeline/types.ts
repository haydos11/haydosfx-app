export type RawCotRow = {
  report_date_as_yyyy_mm_dd?: string;
  market_and_exchange_names?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
  comm_positions_long_all?: string | number;
  comm_positions_short_all?: string | number;
  nonrept_positions_long_all?: string | number;
  nonrept_positions_short_all?: string | number;
  open_interest_all?: string | number | null;
  [key: string]: unknown;
};

export type CotMarketMeta = {
  market_code: string;
  market_name: string;
  socrata_key: string | null;
  cftc_code: string | null;
  category: string | null;
  base_ccy: string | null;
  quote_ccy: string | null;
  price_convention: string | null;
  contract_size: number;
  contract_unit: string;
  usd_direction_if_long: number;
  is_active?: boolean;
};

export type CotReportRow = {
  report_date: string;
  market_code: string;
  market_name: string;
  socrata_key: string | null;
  cftc_code: string | null;
  category: string | null;
  long_noncommercial: number | null;
  short_noncommercial: number | null;
  spread_noncommercial: number | null;
  long_commercial: number | null;
  short_commercial: number | null;
  long_nonreportable: number | null;
  short_nonreportable: number | null;
  oi_total: number | null;
  net_noncommercial: number | null;
  net_commercial: number | null;
  net_nonreportable: number | null;
  net_noncommercial_pct_oi: number | null;
  net_commercial_pct_oi: number | null;
  net_nonreportable_pct_oi: number | null;
  native_notional: number | null;
  usd_signed_exposure: number | null;
  raw_json: Record<string, unknown>;
};