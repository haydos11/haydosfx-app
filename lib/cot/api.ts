import type { CotSeries } from "@/lib/cot/shape";

export type ApiCotRows = {
  updated: string;
  range: { start: string; end: string; years?: number | null };
  count: number;
  rows: Array<{
    report_date_as_yyyy_mm_dd?: string;
    report_date_long?: string;
    market_and_exchange_names?: string;
    contract_market_name?: string;
    noncomm_positions_long_all?: string | number;
    noncomm_positions_short_all?: string | number;
    noncomm_positions_spread_all?: string | number;
    change_in_noncomm_long_all?: string | number;
    change_in_noncomm_short_all?: string | number;
    pct_of_oi_noncomm_long_all?: string | number;
    pct_of_oi_noncomm_short_all?: string | number;
  }>;
};

export type ApiCotDistribution = {
  updated: string;
  range: { start: string; end: string; years?: number | null };
  count: number;
  rows: ApiCotRows["rows"];
  distribution: Array<{
    market: string;
    date: string;  // YYYY-MM-DD
    long: number;
    short: number;
    net: number;
    pctLong?: number | null;
    pctShort?: number | null;
  }>;
};

export type ApiCotUnified = {
  updated: string;
  range: { start: string; end: string; years?: number | null };
  startDate?: string | null;
  selected?: {
    groups: string[];
    ids: string[];
    count: number;
    names: { id: string; code: string; name: string }[];
  };
  series: CotSeries[];
};
