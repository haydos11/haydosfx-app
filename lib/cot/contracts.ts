// lib/cot/contracts.ts
import type { MarketInfo } from "./markets";

/** A pricing source we’ll query for the report date (COT Tuesday). */
export type PriceSource =
  | { kind: "yahoo"; symbol: string }
  | { kind: "fixedUSD" };

/** Contract spec: translate net contracts -> USD notional. */
export type ContractSpec = {
  contractSize: number;
  priceMultiplier?: number;
  quote?: string;
  price: PriceSource;
  fxUsdPerUnit?: PriceSource;
};

/** Map from your market key -> contract spec */
export const CONTRACT_SPECS: Record<MarketInfo["key"], ContractSpec> = {
  // ---------- Synthetic USD ----------
  usd: {
    contractSize: 1,
    price: { kind: "fixedUSD" },
    quote: "Synthetic USD basket; sizing handled in serving layer",
  },

  // ---------- FX (CME) ----------
  eur: {
    contractSize: 125_000,
    price: { kind: "yahoo", symbol: "EURUSD=X" },
    quote: "USD per EUR",
  },
  gbp: {
    contractSize: 62_500,
    price: { kind: "yahoo", symbol: "GBPUSD=X" },
    quote: "USD per GBP",
  },
  jpy: {
    contractSize: 12_500_000,
    price: { kind: "yahoo", symbol: "JPY=X" },
    quote: "JPY per USD (invert to USD per JPY)",
  },
  aud: {
    contractSize: 100_000,
    price: { kind: "yahoo", symbol: "AUDUSD=X" },
    quote: "USD per AUD",
  },
  nzd: {
    contractSize: 100_000,
    price: { kind: "yahoo", symbol: "NZDUSD=X" },
    quote: "USD per NZD",
  },
  cad: {
    contractSize: 100_000,
    price: { kind: "yahoo", symbol: "CAD=X" },
    quote: "CAD per USD (invert to USD per CAD)",
  },
  chf: {
    contractSize: 125_000,
    price: { kind: "yahoo", symbol: "CHFUSD=X" },
    quote: "USD per CHF",
  },
  mxn: {
    contractSize: 500_000,
    price: { kind: "yahoo", symbol: "MXN=X" },
    quote: "MXN per USD (invert to USD per MXN)",
  },

  // ---------- Metals (COMEX) ----------
  gold: {
    contractSize: 100,
    price: { kind: "yahoo", symbol: "GC=F" },
    quote: "USD per troy oz",
  },
  silver: {
    contractSize: 5_000,
    price: { kind: "yahoo", symbol: "SI=F" },
    quote: "USD per troy oz",
  },
  copper: {
    contractSize: 25_000,
    price: { kind: "yahoo", symbol: "HG=F" },
    quote: "USD per lb",
  },

  // ---------- Energy ----------
  wti: {
    contractSize: 1_000,
    price: { kind: "yahoo", symbol: "CL=F" },
    quote: "USD per barrel",
  },
  brent: {
    contractSize: 1_000,
    price: { kind: "yahoo", symbol: "BZ=F" },
    quote: "USD per barrel",
  },
  rbob: {
    contractSize: 42_000,
    price: { kind: "yahoo", symbol: "RB=F" },
    quote: "USD per gallon",
  },
  ng: {
    contractSize: 10_000,
    price: { kind: "yahoo", symbol: "NG=F" },
    quote: "USD per MMBtu",
  },

  // ---------- Ags / Livestock / Softs ----------
  corn: {
    contractSize: 5_000,
    price: { kind: "yahoo", symbol: "ZC=F" },
    quote: "USD per bushel",
  },
  wheat: {
    contractSize: 5_000,
    price: { kind: "yahoo", symbol: "ZW=F" },
    quote: "USD per bushel",
  },
  soy: {
    contractSize: 5_000,
    price: { kind: "yahoo", symbol: "ZS=F" },
    quote: "USD per bushel",
  },
  sugar11: {
    contractSize: 112_000,
    priceMultiplier: 0.01,
    price: { kind: "yahoo", symbol: "SB=F" },
    quote: "US cents per lb",
  },
  coffee: {
    contractSize: 37_500,
    priceMultiplier: 0.01,
    price: { kind: "yahoo", symbol: "KC=F" },
    quote: "US cents per lb",
  },
  cocoa: {
    contractSize: 10,
    price: { kind: "yahoo", symbol: "CC=F" },
    quote: "USD per metric ton",
  },
  lc: {
    contractSize: 40_000,
    priceMultiplier: 0.01,
    price: { kind: "yahoo", symbol: "LE=F" },
    quote: "US cents per lb (Live Cattle)",
  },
  lh: {
    contractSize: 40_000,
    priceMultiplier: 0.01,
    price: { kind: "yahoo", symbol: "HE=F" },
    quote: "US cents per lb (Lean Hogs)",
  },

  // ---------- Indices ----------
  spx: {
    contractSize: 1,
    priceMultiplier: 250,
    price: { kind: "yahoo", symbol: "^GSPC" },
    quote: "Index * $250",
  },
  ndx: {
    contractSize: 1,
    priceMultiplier: 100,
    price: { kind: "yahoo", symbol: "^NDX" },
    quote: "Index * $100",
  },
  djia: {
    contractSize: 1,
    priceMultiplier: 10,
    price: { kind: "yahoo", symbol: "^DJI" },
    quote: "Index * $10",
  },

  // ---------- Crypto ----------
  btc: {
    contractSize: 5,
    price: { kind: "yahoo", symbol: "BTC-USD" },
    quote: "USD per BTC",
  },
};