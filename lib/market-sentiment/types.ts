export type MarketSentimentAssetClass =
  | "equity"
  | "volatility"
  | "bond"
  | "commodity"
  | "fx"
  | "rates";

export type MarketSentimentAsset = {
  code: string;
  name: string;
  symbols: string[];
  assetClass: MarketSentimentAssetClass;
  weight: number;
  polarity: -1 | 0 | 1;
};

export type IntradayPriceRow = {
  ts: string;
  asset_code: string;
  asset_name: string;
  asset_class: MarketSentimentAssetClass;
  source: string;
  price: number;
  session_change_pct: number | null;
  london_change_pct: number | null;
  day_change_pct: number | null;
  hour_change_pct: number | null;
  prev_15m_change_pct: number | null;
  previous_day_same_time_change_pct?: number | null;
  rolling_2h_change_pct?: number | null;
  rolling_4h_change_pct?: number | null;
};

export type SnapshotComponent = {
  score: number;
  latestChange: number | null;
  hourChange: number | null;
  rolling2hChange?: number | null;
  rolling4hChange?: number | null;
  previousDaySameTimeChange?: number | null;
  londonChange: number | null;
  sessionChange: number | null;
  direction: "risk_on" | "risk_off" | "neutral";
};

export type IntradaySnapshotRow = {
  ts: string;
  regime: string;
  score: number;
  breadth: number;
  improving: boolean;
  degrading: boolean;
  confidence: number;
  previous_score_change: number | null;
  london_change_score: number | null;
  session_change_score: number | null;
  previous_day_same_time_score_change?: number | null;
  rolling_2h_score_change?: number | null;
  rolling_4h_score_change?: number | null;
  summary_text: string;
  components: Record<string, SnapshotComponent>;
};