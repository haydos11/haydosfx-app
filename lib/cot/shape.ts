// === Your existing shapes (unchanged) ===
export type CotRow = {
  date: string; // YYYY-MM-DD
  large_spec_net: number;
  small_traders_net: number;
  commercials_net: number;
  open_interest: number | null;
  d_large?: number; d_small?: number; d_comm?: number; d_oi?: number;
};

export type CotSeries = {
  market: { key: string; code: string; name: string };
  dates: string[];
  large: number[];     // net
  small: number[];
  comm: number[];
  ls_large: number[];  // long/short ratio (optional; we’ll fill with NaN)
  ls_small: number[];
  ls_comm: number[];
  open_interest: (number | null)[];
  recent: CotRow[];    // last N weeks for your table
  updated: string;
};

// === Minimal extra domain types ===
export type MarketDef = {
  id: string;            // slug used in URLs / filters (e.g., "eur")
  code: string;          // short code for your UI (e.g., "EUR")
  name: string;          // pretty name (e.g., "Euro FX")
  socrataKey: string;    // exact market_and_exchange_names in CFTC dataset
  group: "FX" | "INDEX" | "RATES" | "ENERGY" | "METALS" | "AGRI" | "CRYPTO" | "OTHER";
};
