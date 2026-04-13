export type MarketContextPriceRow = {
  asset_code: string;
  asset_class: "yield" | "index" | "vol" | "commodity" | string;
  yahoo_symbol: string;
  price_date: string;
  close: number | null;
  source: string | null;
  updated_at: string;
};

export type MarketContextGroupedRow = {
  asset_code: string;
  asset_class: string;
  yahoo_symbol: string;
  latest_date: string;
  latest_close: number | null;
  previous_date: string | null;
  previous_close: number | null;
  absolute_change: number | null;
  percent_change: number | null;
};