// G8 currency universe and canonical Yahoo symbols for unique pairs.
// We fetch each unordered pair once; for index maths we flip via sign.

export const G8 = ["USD", "EUR", "JPY", "GBP", "AUD", "NZD", "CAD", "CHF"] as const;
export type CCY = (typeof G8)[number];

export type YSymbol = `${string}=X`;

export type PairRow = Readonly<{
  a: CCY; // base in our canonical storage
  b: CCY; // quote in our canonical storage
  y: YSymbol; // Yahoo Finance symbol
}>;

// Canonical unique set (unordered pairs; we list one orientation only)
export const PAIRS: readonly PairRow[] = [
  // USD crosses
  { a: "EUR", b: "USD", y: "EURUSD=X" },
  { a: "GBP", b: "USD", y: "GBPUSD=X" },
  { a: "AUD", b: "USD", y: "AUDUSD=X" },
  { a: "NZD", b: "USD", y: "NZDUSD=X" },
  { a: "USD", b: "JPY", y: "USDJPY=X" },
  { a: "USD", b: "CAD", y: "USDCAD=X" },
  { a: "USD", b: "CHF", y: "USDCHF=X" },

  // EUR crosses
  { a: "EUR", b: "GBP", y: "EURGBP=X" },
  { a: "EUR", b: "JPY", y: "EURJPY=X" },
  { a: "EUR", b: "CHF", y: "EURCHF=X" },
  { a: "EUR", b: "CAD", y: "EURCAD=X" },
  { a: "EUR", b: "AUD", y: "EURAUD=X" },
  { a: "EUR", b: "NZD", y: "EURNZD=X" },

  // GBP crosses
  { a: "GBP", b: "JPY", y: "GBPJPY=X" },
  { a: "GBP", b: "CHF", y: "GBPCHF=X" },
  { a: "GBP", b: "CAD", y: "GBPCAD=X" },
  { a: "GBP", b: "AUD", y: "GBPAUD=X" },
  { a: "GBP", b: "NZD", y: "GBPNZD=X" },

  // AUD crosses
  { a: "AUD", b: "JPY", y: "AUDJPY=X" },
  { a: "AUD", b: "CHF", y: "AUDCHF=X" },
  { a: "AUD", b: "CAD", y: "AUDCAD=X" },
  { a: "AUD", b: "NZD", y: "AUDNZD=X" },

  // NZD crosses
  { a: "NZD", b: "JPY", y: "NZDJPY=X" },
  { a: "NZD", b: "CHF", y: "NZDCHF=X" },
  { a: "NZD", b: "CAD", y: "NZDCAD=X" },

  // CAD / CHF / JPY residuals
  { a: "CAD", b: "JPY", y: "CADJPY=X" },
  { a: "CAD", b: "CHF", y: "CADCHF=X" },
  { a: "CHF", b: "JPY", y: "CHFJPY=X" },
] as const;

/** Find the canonical stored pair (unordered lookup). */
export function hasPair(base: CCY, quote: CCY): PairRow | undefined {
  return PAIRS.find(
    (p) => (p.a === base && p.b === quote) || (p.a === quote && p.b === base)
  );
}
