import type { MarketSentimentAsset } from "./types";

export const MARKET_SENTIMENT_INTERVAL = "15m";
export const MARKET_SENTIMENT_RETENTION_DAYS = 14;

export const MARKET_SENTIMENT_ASSETS: MarketSentimentAsset[] = [
  // Core US risk proxies
  {
    code: "SPY",
    name: "SPY",
    symbols: ["SPY"],
    assetClass: "equity",
    weight: 1.35,
    polarity: 1,
  },
  {
    code: "QQQ",
    name: "QQQ",
    symbols: ["QQQ"],
    assetClass: "equity",
    weight: 1.35,
    polarity: 1,
  },

  // Europe / Asia confirmation
  {
    code: "GER40",
    name: "GER40",
    symbols: ["^GDAXI"],
    assetClass: "equity",
    weight: 1.05,
    polarity: 1,
  },
  {
    code: "FRA40",
    name: "FRA40",
    symbols: ["^FCHI"],
    assetClass: "equity",
    weight: 0.85,
    polarity: 1,
  },
  {
    code: "JP225",
    name: "JP225",
    symbols: ["^N225"],
    assetClass: "equity",
    weight: 0.95,
    polarity: 1,
  },

  // Fear gauge
  {
    code: "VIX",
    name: "VIX",
    symbols: ["^VIX"],
    assetClass: "volatility",
    weight: 1.65,
    polarity: -1,
  },

  // FX risk appetite / carry
  {
    code: "AUDJPY",
    name: "AUDJPY",
    symbols: ["AUDJPY=X"],
    assetClass: "fx",
    weight: 1.55,
    polarity: 1,
  },
  {
    code: "USDJPY",
    name: "USDJPY",
    symbols: ["JPY=X"],
    assetClass: "fx",
    weight: 0.95,
    polarity: 1,
  },
  {
    code: "EURCHF",
    name: "EURCHF",
    symbols: ["EURCHF=X"],
    assetClass: "fx",
    weight: 1.00,
    polarity: 1,
  },

  // Bonds / duration
  {
    code: "TLT",
    name: "TLT",
    symbols: ["TLT"],
    assetClass: "bond",
    weight: 0.90,
    polarity: -1,
  },

  // Contextual rates (visible but not directly scored)
  {
    code: "US2Y",
    name: "US 2Y",
    symbols: ["2YY=F", "^AXTWO"],
    assetClass: "rates",
    weight: 0.40,
    polarity: 0,
  },
  {
    code: "US10Y",
    name: "US 10Y",
    symbols: ["^TNX"],
    assetClass: "rates",
    weight: 0.50,
    polarity: 0,
  },

  // Growth commodities
  {
    code: "COPPER",
    name: "Copper",
    symbols: ["HG=F"],
    assetClass: "commodity",
    weight: 0.95,
    polarity: 1,
  },
  {
    code: "WTI",
    name: "WTI",
    symbols: ["CL=F"],
    assetClass: "commodity",
    weight: 0.55,
    polarity: 1,
  },

  // Defensive commodity
  {
    code: "XAUUSD",
    name: "Gold",
    symbols: ["GC=F"],
    assetClass: "commodity",
    weight: 0.65,
    polarity: -1,
  },
];