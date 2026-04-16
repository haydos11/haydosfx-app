// G8 currency universe and canonical Yahoo symbols for unique pairs.
// We fetch each unordered pair once; for index maths we flip via sign.

export const G8 = ["USD", "EUR", "JPY", "GBP", "AUD", "NZD", "CAD", "CHF"] as const;
export type CCY = (typeof G8)[number];

export type YSymbol = `${string}=X`;
export type TradeDirection = "long" | "short";

export type PairRow = Readonly<{
  a: CCY; // canonical base
  b: CCY; // canonical quote
  y: YSymbol; // Yahoo Finance symbol
}>;

export type NormalizedIdeaPair = Readonly<{
  symbol: string; // canonical symbol, e.g. NZDCAD
  direction: TradeDirection; // flipped if input was reversed
  inverted: boolean; // true if canonical symbol forced direction inversion
  base: CCY;
  quote: CCY;
  yahooSymbol: YSymbol;
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

export function isCCY(value: string): value is CCY {
  return (G8 as readonly string[]).includes(value);
}

export function flipTradeDirection(direction: TradeDirection): TradeDirection {
  return direction === "long" ? "short" : "long";
}

/**
 * Normalize a directional trade idea expressed as:
 *   longCcy vs shortCcy
 * into canonical market symbol + correct long/short direction.
 *
 * Example:
 *   long CAD vs short NZD
 * becomes:
 *   NZDCAD short
 */
export function normalizeIdeaFromCurrencies(
  longCcy: CCY,
  shortCcy: CCY
): NormalizedIdeaPair | null {
  if (longCcy === shortCcy) return null;

  const pair = hasPair(longCcy, shortCcy);
  if (!pair) return null;

  const canonicalSymbol = `${pair.a}${pair.b}`;

  if (pair.a === longCcy && pair.b === shortCcy) {
    return {
      symbol: canonicalSymbol,
      direction: "long",
      inverted: false,
      base: pair.a,
      quote: pair.b,
      yahooSymbol: pair.y,
    };
  }

  if (pair.a === shortCcy && pair.b === longCcy) {
    return {
      symbol: canonicalSymbol,
      direction: "short",
      inverted: true,
      base: pair.a,
      quote: pair.b,
      yahooSymbol: pair.y,
    };
  }

  return null;
}

/**
 * Normalize an idea already expressed as symbol + direction.
 *
 * Example:
 *   CADNZD long -> NZDCAD short
 *   AUDJPY long -> AUDJPY long
 */
export function normalizeIdeaSymbol(
  symbol: string,
  direction: TradeDirection
): NormalizedIdeaPair | null {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, "");

  if (clean.length !== 6) {
    return null;
  }

  const base = clean.slice(0, 3);
  const quote = clean.slice(3, 6);

  if (!isCCY(base) || !isCCY(quote) || base === quote) {
    return null;
  }

  const pair = hasPair(base, quote);
  if (!pair) {
    return null;
  }

  const canonicalSymbol = `${pair.a}${pair.b}`;

  if (pair.a === base && pair.b === quote) {
    return {
      symbol: canonicalSymbol,
      direction,
      inverted: false,
      base: pair.a,
      quote: pair.b,
      yahooSymbol: pair.y,
    };
  }

  return {
    symbol: canonicalSymbol,
    direction: flipTradeDirection(direction),
    inverted: true,
    base: pair.a,
    quote: pair.b,
    yahooSymbol: pair.y,
  };
}

export function normalizeIdeaText(
  symbol: string,
  direction: TradeDirection
): { symbol: string; direction: TradeDirection } {
  const normalized = normalizeIdeaSymbol(symbol, direction);

  if (!normalized) {
    return { symbol, direction };
  }

  return {
    symbol: normalized.symbol,
    direction: normalized.direction,
  };
}

export function formatTradeIdea(
  symbol: string,
  direction: TradeDirection,
  reason?: string | null
): string {
  const normalized = normalizeIdeaText(symbol, direction);
  const side = normalized.direction === "long" ? "Long" : "Short";

  return reason?.trim()
    ? `${side} ${normalized.symbol} — ${reason.trim()}`
    : `${side} ${normalized.symbol}`;
}