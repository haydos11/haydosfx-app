import type { MarketSentimentAsset } from "./types";

export const MARKET_SENTIMENT_INTERVAL = "15m";
export const MARKET_SENTIMENT_RETENTION_DAYS = 14;

export const MARKET_SENTIMENT_ASSETS: MarketSentimentAsset[] = [
  { code: "SPY", name: "SPY", symbols: ["SPY"], assetClass: "equity", weight: 1.2, polarity: 1 },
  { code: "QQQ", name: "QQQ", symbols: ["QQQ"], assetClass: "equity", weight: 1.2, polarity: 1 },
  { code: "VIX", name: "VIX", symbols: ["^VIX"], assetClass: "volatility", weight: 1.5, polarity: -1 },
  { code: "TLT", name: "TLT", symbols: ["TLT"], assetClass: "bond", weight: 0.7, polarity: -1 },
  { code: "XAUUSD", name: "Gold", symbols: ["GC=F"], assetClass: "commodity", weight: 0.5, polarity: -1 },
  { code: "COPPER", name: "Copper", symbols: ["HG=F"], assetClass: "commodity", weight: 0.8, polarity: 1 },
  { code: "WTI", name: "WTI", symbols: ["CL=F"], assetClass: "commodity", weight: 0.4, polarity: 1 },
  { code: "AUDJPY", name: "AUDJPY", symbols: ["AUDJPY=X"], assetClass: "fx", weight: 1.4, polarity: 1 },
  { code: "USDJPY", name: "USDJPY", symbols: ["JPY=X"], assetClass: "fx", weight: 0.6, polarity: 1 },
  { code: "EURCHF", name: "EURCHF", symbols: ["EURCHF=X"], assetClass: "fx", weight: 0.8, polarity: 1 },

  // 2Y is the messiest Yahoo leg, so use multiple fallbacks.
  { code: "US2Y", name: "US 2Y", symbols: ["2YY=F", "^AXTWO"], assetClass: "rates", weight: 0.4, polarity: 0 },

  { code: "US10Y", name: "US 10Y", symbols: ["^TNX"], assetClass: "rates", weight: 0.5, polarity: 0 },
  { code: "JP225", name: "JP225", symbols: ["^N225"], assetClass: "equity", weight: 0.9, polarity: 1 },
  { code: "GER40", name: "GER40", symbols: ["^GDAXI"], assetClass: "equity", weight: 1.0, polarity: 1 },
  { code: "FRA40", name: "FRA40", symbols: ["^FCHI"], assetClass: "equity", weight: 0.8, polarity: 1 },
];