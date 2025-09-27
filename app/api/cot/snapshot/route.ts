// app/api/cot/snapshot/route.ts
import { NextResponse } from "next/server";
import { MARKETS } from "@/lib/cot/markets";
import { CONTRACT_SPECS } from "@/lib/cot/contracts";
import { yahooCloseOn, inv } from "@/lib/pricing/yahoo";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

// ---------- Quick-cache config ----------
const TTL_SECONDS = 600; // 10 minutes
const RESPONSE_CACHE_HEADERS: HeadersInit = {
  // CDN cache 10m; serve stale up to 24h while revalidating
  "Cache-Control": "s-maxage=600, stale-while-revalidate=86400, max-age=0",
  "X-From": "SNAPSHOT_ROUTE",
} as const;

/** ---------- Types ---------- */

type CftcRow = {
  report_date_as_yyyy_mm_dd?: string;
  market_and_exchange_names?: string;
  contract_market_name?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
  open_interest_all?: string | number | null;
};

type PriceYahoo = { kind: "yahoo"; symbol: string };
type PriceFixedUSD = { kind: "fixedUSD" };
type PriceKind = PriceYahoo | PriceFixedUSD;

type ContractSpec = {
  contractSize: number;
  priceMultiplier?: number;
  price: PriceKind;
};

type Market = {
  key: string;
  code: string;
  name: string;
  group: string;
  cftcName: string;
};

type OutRow = {
  key: string;
  code: string;
  name: string;
  group: string;
  date: string | null;

  longPct: number;
  prevLongPct: number;
  shortPct: number;
  prevShortPct: number;

  net: number;
  netContracts: number;
  netPos: number;
  prevNet: number;

  openInterest: number | null;

  price: number | null;
  contractSize: number | null;
  priceMultiplier: number;
  usdNotional: number | null;
  prevUsdNotional: number | null;

  // Only on error paths:
  reason?: string;
};

/** ---------- Helpers ---------- */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const esc = (s: string) => s.replace(/'/g, "''");

const pct = (long: number, short: number) => {
  const d = long + short;
  return d === 0
    ? { longPct: 0, shortPct: 0 }
    : { longPct: (long / d) * 100, shortPct: (short / d) * 100 };
};

/** ----------------------------------------------------------------------------
 * STRICT filters for single, full-size CME contracts
 * - E6: EURO FX - CHICAGO MERCANTILE EXCHANGE  | short: EURO FX
 * - N6: NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE | short: NZ DOLLAR
 *   (also accept "NEW ZEALAND DOLLAR" variants defensively)
 * Excludes: E-MINI/E-MICRO and any crosses (with '/').
 * ---------------------------------------------------------------------------*/
type StrictSpec = { longNames: string[]; shortNames: string[]; excludeLike?: string[] };

const STRICT_LIST: StrictSpec[] = [
  {
    longNames: ["EURO FX - CHICAGO MERCANTILE EXCHANGE"],
    shortNames: ["EURO FX"],
    excludeLike: ["E-MINI%", "E MICRO%", "E-MICRO%", "%/%"],
  },
  {
    longNames: [
      "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE",
      "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    ],
    shortNames: ["NZ DOLLAR", "NEW ZEALAND DOLLAR"],
    excludeLike: ["E-MINI%", "E MICRO%", "E-MICRO%", "%/%"],
  },
];

/** If cftcName matches a strict spec (by longName), return strict WHERE; else undefined */
function maybeStrictWhere(cftcName: string): string | undefined {
  const upper = cftcName.toUpperCase().trim();
  const spec = STRICT_LIST.find((s) => s.longNames.some((ln) => ln.toUpperCase() === upper));
  if (!spec) return undefined;

  const parts: string[] = [];
  parts.push(
    "(" +
      spec.longNames
        .map((ln) => `UPPER(market_and_exchange_names) = '${esc(ln).toUpperCase()}'`)
        .join(" OR ") +
      ")"
  );
  parts.push(
    "(" +
      ["contract_market_name IS NULL"]
        .concat(spec.shortNames.map((sn) => `UPPER(contract_market_name) = '${esc(sn).toUpperCase()}'`))
        .join(" OR ") +
      ")"
  );

  if (spec.excludeLike?.length) {
    parts.push(
      spec.excludeLike
        .map(
          (p) =>
            `NOT (UPPER(contract_market_name) LIKE '${esc(p).toUpperCase()}' OR UPPER(market_and_exchange_names) LIKE '${esc(p).toUpperCase()}')`
        )
        .join(" AND ")
    );
  }
  return parts.join(" AND ");
}

/** Your original broad matcher (kept for all non-strict markets) */
function broadWhere(cftcName: string) {
  const longName = cftcName;
  const baseShort = longName.split(" - ")[0];
  const shortCandidates = Array.from(
    new Set([
      baseShort,
      baseShort.replace(/\s+STERLING\b/i, ""), // GBP -> allow "BRITISH POUND"
    ])
  );

  return (
    "(" +
    shortCandidates
      .map(
        (s) =>
          `(contract_market_name = '${esc(s)}' OR UPPER(contract_market_name) LIKE '${esc(s).toUpperCase()}%')`
      )
      .join(" OR ") +
    ` OR UPPER(market_and_exchange_names) LIKE '${esc(longName).toUpperCase()}%'` +
    ") AND " +
    // Always exclude minis/micros/crosses in broad mode
    [
      "UPPER(contract_market_name) NOT LIKE '%E-MINI%'",
      "UPPER(market_and_exchange_names) NOT LIKE '%E-MINI%'",
      "UPPER(contract_market_name) NOT LIKE '%E MICRO%'",
      "UPPER(contract_market_name) NOT LIKE '%E-MICRO%'",
      "UPPER(market_and_exchange_names) NOT LIKE '%/%'",
      "UPPER(contract_market_name) NOT LIKE '%/%'",
    ].join(" AND ")
  );
}

async function fetchLatestTwoRowsForMarket(cftcName: string): Promise<CftcRow[]> {
  const select = [
    "report_date_as_yyyy_mm_dd",
    "market_and_exchange_names",
    "contract_market_name",
    "noncomm_positions_long_all",
    "noncomm_positions_short_all",
    "open_interest_all",
  ].join(", ");

  // Try strict first for E6 / N6, fall back to broad for others
  const strictWhere = maybeStrictWhere(cftcName);
  const where = strictWhere ?? broadWhere(cftcName);

  const url = `${CFTC_URL}?$select=${encodeURIComponent(select)}&$where=${encodeURIComponent(
    where
  )}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=2`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: TTL_SECONDS },
  });
  if (!res.ok) throw new Error(`CFTC ${res.status}: ${await res.text()}`);
  return (await res.json()) as CftcRow[];
}

/** Inversion list for Yahoo symbols where quoted value must be inverted */
const INVERT_IF = new Set<string>(["JPY=X", "CAD=X", "MXN=X"]);

export async function GET() {
  const out: OutRow[] = [];

  for (const m of MARKETS as Market[]) {
    let latest: CftcRow | undefined;
    let prev: CftcRow | undefined;

    try {
      const rows = await fetchLatestTwoRowsForMarket(m.cftcName);
      latest = rows[0];
      prev = rows[1];
    } catch (e) {
      out.push({
        key: m.key,
        code: m.code,
        name: m.name,
        group: m.group,
        date: null,
        longPct: 0,
        prevLongPct: 0,
        shortPct: 0,
        prevShortPct: 0,
        net: 0,
        netContracts: 0,
        netPos: 0,
        prevNet: 0,
        openInterest: null,
        price: null,
        contractSize: (CONTRACT_SPECS as Record<string, ContractSpec | undefined>)[m.key]?.contractSize ?? null,
        priceMultiplier:
          (CONTRACT_SPECS as Record<string, ContractSpec | undefined>)[m.key]?.priceMultiplier ?? 1,
        usdNotional: null,
        prevUsdNotional: null, // present even in error path
        reason: e instanceof Error ? e.message : "cftc_fetch_error",
      });
      continue;
    }

    if (!latest?.report_date_as_yyyy_mm_dd) {
      const spec = (CONTRACT_SPECS as Record<string, ContractSpec | undefined>)[m.key];
      out.push({
        key: m.key,
        code: m.code,
        name: m.name,
        group: m.group,
        date: null,
        longPct: 0,
        prevLongPct: 0,
        shortPct: 0,
        prevShortPct: 0,
        net: 0,
        netContracts: 0,
        netPos: 0,
        prevNet: 0,
        openInterest: null,
        price: null,
        contractSize: spec?.contractSize ?? null,
        priceMultiplier: spec?.priceMultiplier ?? 1,
        usdNotional: null,
        prevUsdNotional: null,
        reason: "no_latest_row",
      });
      continue;
    }

    // --- Latest (Combined F+O) ---
    const date = latest.report_date_as_yyyy_mm_dd.slice(0, 10);
    const longL = num(latest.noncomm_positions_long_all);
    const shortL = num(latest.noncomm_positions_short_all);
    const net = longL - shortL;

    const { longPct, shortPct } = pct(longL, shortL);

    // --- Previous (if present) ---
    let prevNet = 0;
    let prevLongPct = 0;
    let prevShortPct = 0;
    let prevDate: string | null = null;
    if (prev?.report_date_as_yyyy_mm_dd) {
      const longP = num(prev.noncomm_positions_long_all);
      const shortP = num(prev.noncomm_positions_short_all);
      prevNet = longP - shortP;
      const p = pct(longP, shortP);
      prevLongPct = p.longPct;
      prevShortPct = p.shortPct;
      prevDate = prev.report_date_as_yyyy_mm_dd.slice(0, 10);
    }

    // --- Price / Notional (now with prev as well) ---
    const spec = (CONTRACT_SPECS as Record<string, ContractSpec | undefined>)[m.key];
    let px: number | null = null;
    let usdNotional: number | null = null;
    let pxPrev: number | null = null;
    let prevUsdNotional: number | null = null;

    if (spec) {
      // Latest price
      if (spec.price.kind === "yahoo") {
        const symbol = spec.price.symbol;
        let price = await yahooCloseOn(symbol, date);
        if (price != null && INVERT_IF.has(symbol)) {
          price = inv(price);
        }
        px = price ?? null;
      } else if (spec.price.kind === "fixedUSD") {
        px = 1;
      }

      // Previous week's price (from previous CFTC row date)
      if (prevDate) {
        if (spec.price.kind === "yahoo") {
          const symbol = spec.price.symbol;
          let pricePrev = await yahooCloseOn(symbol, prevDate);
          if (pricePrev != null && INVERT_IF.has(symbol)) {
            pricePrev = inv(pricePrev);
          }
          pxPrev = pricePrev ?? null;
        } else if (spec.price.kind === "fixedUSD") {
          pxPrev = 1;
        }
      }

      const pm = spec.priceMultiplier ?? 1;
      if (px != null) {
        usdNotional = net * spec.contractSize * pm * px;
      }
      if (pxPrev != null && prevDate) {
        prevUsdNotional = prevNet * spec.contractSize * pm * pxPrev;
      }
    }

    out.push({
      key: m.key,
      code: m.code,
      name: m.name,
      group: m.group,
      date,

      longPct,
      prevLongPct,
      shortPct,
      prevShortPct,

      net,
      netContracts: net,
      netPos: net,

      prevNet,

      openInterest: num(latest.open_interest_all),
      price: px,
      contractSize: spec?.contractSize ?? null,
      priceMultiplier: spec?.priceMultiplier ?? 1,
      usdNotional,
      prevUsdNotional, // ← NEW FIELD
    });
  }

  return NextResponse.json(
    { updated: new Date().toISOString(), rows: out, source: "SNAPSHOT_ROUTE" },
    { headers: RESPONSE_CACHE_HEADERS }
  );
}
