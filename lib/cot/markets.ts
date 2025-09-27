// lib/cot/markets.ts
// Back-compatible markets registry + resolver.
// - Stable single source for market metadata
// - Widening coverage = add an entry here

export type MarketGroup =
  | "FX" | "INDEX" | "RATES" | "ENERGY" | "METALS" | "AGRI" | "CRYPTO" | "OTHER";

export type MarketInfo = {
  key: string;       // slug used in URLs (e.g., "eur")
  code: string;      // short code for UI (e.g., "EUR")
  name: string;      // pretty name
  cftcName: string;  // exact market_and_exchange_names in CFTC dataset
  group: MarketGroup;
};

// —— Single source of truth — extend as needed ——
// Note: cftcName must match CFTC "market_and_exchange_names" exactly.
const REGISTRY = [
  /** ======================
   *  FX (Majors / G8+)
   *  ====================== */
  { key: "eur", code: "EUR", name: "Euro FX",           cftcName: "EURO FX - CHICAGO MERCANTILE EXCHANGE",                     group: "FX" },
  { key: "jpy", code: "JPY", name: "Japanese Yen",      cftcName: "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",                group: "FX" },
  { key: "gbp", code: "GBP", name: "British Pound",     cftcName: "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE",      group: "FX" },
  { key: "aud", code: "AUD", name: "Australian Dollar", cftcName: "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",           group: "FX" },
  { key: "nzd", code: "NZD", name: "New Zealand Dollar",cftcName: "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE",          group: "FX" },
  { key: "cad", code: "CAD", name: "Canadian Dollar",   cftcName: "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",             group: "FX" },
  { key: "chf", code: "CHF", name: "Swiss Franc",       cftcName: "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE",                 group: "FX" },
  { key: "mxn", code: "MXN", name: "Mexican Peso",      cftcName: "MEXICAN PESO - CHICAGO MERCANTILE EXCHANGE",                group: "FX" },

  /** ======================
   *  Metals
   *  ====================== */
  { key: "gold",   code: "XAU", name: "Gold",           cftcName: "GOLD - COMMODITY EXCHANGE INC.",                            group: "METALS" },
  { key: "silver", code: "XAG", name: "Silver",         cftcName: "SILVER - COMMODITY EXCHANGE INC.",                          group: "METALS" },
  { key: "copper", code: "HG",  name: "Copper",         cftcName: "COPPER-GRADE #1 - COMMODITY EXCHANGE INC.",                 group: "METALS" },

  /** ======================
   *  Energy
   *  ====================== */
  { key: "wti",    code: "CL",  name: "WTI Crude Oil",  cftcName: "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",     group: "ENERGY" },
  { key: "brent",  code: "BRN", name: "Brent Crude Oil",cftcName: "BRENT CRUDE OIL LAST DAY - NEW YORK MERCANTILE EXCHANGE",   group: "ENERGY" },
  { key: "rbob",   code: "RB",  name: "RBOB Gasoline",  cftcName: "GASOLINE BLENDSTOCK (RBOB) - NEW YORK MERCANTILE EXCHANGE", group: "ENERGY" },
  { key: "ng",     code: "NG",  name: "Natural Gas",    cftcName: "NAT GAS ICE LD1 - ICE FUTURES ENERGY DIV  ",                group: "ENERGY" }, // NEW

  /** ======================
   *  Agricultural / Livestock / Softs
   *  ====================== */
  { key: "corn",   code: "ZC",  name: "Corn",           cftcName: "CORN - CHICAGO BOARD OF TRADE",                             group: "AGRI" },
  { key: "wheat",  code: "ZW",  name: "Wheat (SRW)",    cftcName: "WHEAT-SRW - CHICAGO BOARD OF TRADE",                         group: "AGRI" },
  { key: "soy",    code: "ZS",  name: "Soybeans",       cftcName: "SOYBEANS - CHICAGO BOARD OF TRADE",                          group: "AGRI" },
  { key: "sugar11",code: "SB",  name: "Sugar #11",      cftcName: "SUGAR NO. 11 - ICE FUTURES U.S.",                            group: "AGRI" },
  { key: "coffee", code: "KC",  name: "Coffee",         cftcName: "COFFEE C - ICE FUTURES U.S.",                                group: "AGRI" },
  { key: "cocoa",  code: "CC",  name: "Cocoa",          cftcName: "COCOA - ICE FUTURES U.S.",                                   group: "AGRI" },
  { key: "lc",     code: "LE",  name: "Live Cattle",    cftcName: "LIVE CATTLE - CHICAGO MERCANTILE EXCHANGE",                  group: "AGRI" }, // NEW
  { key: "lh",     code: "HE",  name: "Lean Hogs",      cftcName: "LEAN HOGS - CHICAGO MERCANTILE EXCHANGE",                    group: "AGRI" }, // NEW

  /** ======================
   *  Index / Crypto
   *  ====================== */
  // Switched from E-mini to FULL-SIZE S&P 500 to avoid FX/E-mini matching confusion
  { key: "spx",  code: "SPX", name: "S&P 500 (Consolidated)",     cftcName: "S&P 500 Consolidated - CHICAGO MERCANTILE EXCHANGE", group: "INDEX" },
  { key: "ndx",  code: "NDX", name: "NASDAQ-100 (Consolidated)",  cftcName: "NASDAQ-100 Consolidated - CHICAGO MERCANTILE EXCHANGE", group: "INDEX" },
  { key: "djia", code: "DJI", name: "DJIA (Consolidated)",         cftcName: "DJIA Consolidated - CHICAGO BOARD OF TRADE",          group: "INDEX" },
  { key: "btc",  code: "BTC", name: "Bitcoin CME Futures",         cftcName: "BITCOIN - CHICAGO MERCANTILE EXCHANGE",               group: "CRYPTO" },
  ] as const satisfies ReadonlyArray<MarketInfo>;

// —— Useful unions derived from the registry ——
export type MarketKey  = (typeof REGISTRY)[number]["key"];
export type MarketCode = (typeof REGISTRY)[number]["code"];

// —— Exports ——
export const MARKETS: readonly MarketInfo[] = REGISTRY;

export const MARKET_BY_KEY: Record<string, MarketInfo> =
  Object.fromEntries(REGISTRY.map(m => [m.key, m]));

export const MARKET_BY_CODE: Record<string, MarketInfo> =
  Object.fromEntries(REGISTRY.map(m => [m.code.toUpperCase(), m]));

export const MARKET_BY_CFTC: Record<string, MarketInfo> =
  Object.fromEntries(REGISTRY.map(m => [m.cftcName, m]));

// Back-compatible resolver
export function resolveMarket(q: string | MarketInfo | undefined | null): MarketInfo | null {
  if (!q) return null;
  if (typeof q !== "string") return q;

  const raw = q.trim();
  if (!raw) return null;

  const byKey  = MARKET_BY_KEY[raw.toLowerCase()];
  if (byKey) return byKey;

  const byCode = MARKET_BY_CODE[raw.toUpperCase()];
  if (byCode) return byCode;

  const byCftc = MARKET_BY_CFTC[raw]; // must be exact match
  if (byCftc) return byCftc;

  return null;
}

export function listMarkets(group?: MarketGroup): MarketInfo[] {
  return group ? REGISTRY.filter(m => m.group === group) : [...REGISTRY];
}

export const MARKET_KEYS: MarketKey[] = REGISTRY.map(m => m.key);

// Dev-time guardrails: catch duplicates early
if (process.env.NODE_ENV !== "production") {
  const seenKey = new Set<string>(), seenCftc = new Set<string>();
  for (const m of REGISTRY) {
    if (seenKey.has(m.key))  console.warn(`[markets] duplicate key: ${m.key}`);
    if (seenCftc.has(m.cftcName)) console.warn(`[markets] duplicate cftcName: ${m.cftcName}`);
    seenKey.add(m.key); seenCftc.add(m.cftcName);
  }
}
