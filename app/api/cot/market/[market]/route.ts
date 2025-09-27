// app/api/cot/market/[market]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveMarket } from "@/lib/cot/markets";
import type { CotSeries } from "@/lib/cot/shape";
import { CONTRACT_SPECS } from "@/lib/cot/contracts";
import { yahooCloseOn, inv } from "@/lib/pricing/yahoo";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** ---------- Types ---------- */

type CftcRow = {
  report_date_as_yyyy_mm_dd?: string;
  market_and_exchange_names?: string;
  contract_market_name?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
  comm_positions_long_all?: string | number;
  comm_positions_short_all?: string | number;
  nonrept_positions_long_all?: string | number;
  nonrept_positions_short_all?: string | number;
  open_interest_all?: string | number | null;
};

type CotPointUSD = { date: string; netNotionalUSD: number | null };

type PriceSpec = {
  contractSize?: number;
  priceMultiplier?: number;
  price?: { kind: "yahoo"; symbol: string };
};

type FxMapRow = { ticker: string; inverse?: boolean; defaultSize: number };

/** ---------- Config ---------- */

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

// Quick-cache config
const TTL_SECONDS = 600; // 10 minutes
const RESPONSE_CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "s-maxage=600, stale-while-revalidate=86400, max-age=0",
};

/** ---------- Utils ---------- */

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
};
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const esc = (s: string) => s.replace(/'/g, "''"); // SoQL escape

function resolveRange(u: URL): { from: string; to: string; label: string } {
  const now = new Date();
  const to = toISO(now);
  const yearsParam = u.searchParams.get("years");
  if (yearsParam) {
    const y = Math.max(1, Math.min(20, Number(yearsParam) || 5));
    return { from: toISO(yearsAgo(y)), to, label: `${y}y` };
  }
  const r = (u.searchParams.get("range") || "5y").toLowerCase();
  switch (r) {
    case "ytd":
      return { from: toISO(startOfYear(now)), to, label: "ytd" };
    case "1y":
      return { from: toISO(yearsAgo(1)), to, label: "1y" };
    case "3y":
      return { from: toISO(yearsAgo(3)), to, label: "3y" };
    case "5y":
      return { from: toISO(yearsAgo(5)), to, label: "5y" };
    case "max":
      return { from: "1900-01-01", to, label: "max" };
    default:
      return { from: toISO(yearsAgo(5)), to, label: "5y" };
  }
}

/** ---------------- Strict filters (for FX to exclude E-mini/Micro) ---------------- */
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

function maybeStrictNameClause(cftcName: string): string | undefined {
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

/** Broad (tolerant) matcher for everything else */
function broadNameClause(cftcName: string) {
  const longName = cftcName.trim();
  const baseShort = longName.split(" - ")[0].trim();

  const shortCandidates = new Set<string>([
    baseShort,
    baseShort.replace(/\s+STERLING\b/i, ""),
    baseShort.replace(/\s+LAST DAY\b/i, ""), // e.g. BRENT LAST DAY -> BRENT
  ]);

  // Brent variants (CFTC sometimes uses CRUDE OIL, BRENT or BRENT LAST DAY)
  if (/BRENT/i.test(baseShort)) {
    shortCandidates.add("CRUDE OIL, BRENT");
    shortCandidates.add("BRENT CRUDE OIL");
    shortCandidates.add("BRENT");
  }

  // ULSD / Heating Oil variants
  if (/ULSD|HEATING OIL/i.test(baseShort)) {
    shortCandidates.add("HEATING OIL");
    shortCandidates.add("NEW YORK HARBOR ULSD");
  }

  const clause =
    "(" +
    Array.from(shortCandidates)
      .map(
        (s) =>
          `(contract_market_name = '${esc(s)}' OR UPPER(contract_market_name) LIKE '${esc(s).toUpperCase()}%')`
      )
      .join(" OR ") +
    ` OR UPPER(market_and_exchange_names) LIKE '${esc(longName).toUpperCase()}%'` +
    ")";

  // Only block E-mini/E-micro/ratio for FX (to avoid EUR/GBP collisions).
  const isFX =
    /EURO FX|AUSTRALIAN DOLLAR|NEW ZEALAND DOLLAR|CANADIAN DOLLAR|SWISS FRANC|JAPANESE YEN|MEXICAN PESO/i.test(
      longName
    );

  const exclude = isFX
    ? "AND UPPER(contract_market_name) NOT LIKE '%E-MINI%' " +
      "AND UPPER(market_and_exchange_names) NOT LIKE '%E-MINI%' " +
      "AND UPPER(contract_market_name) NOT LIKE '%E MICRO%' " +
      "AND UPPER(contract_market_name) NOT LIKE '%E-MICRO%' " +
      "AND UPPER(market_and_exchange_names) NOT LIKE '%/%' " +
      "AND UPPER(contract_market_name) NOT LIKE '%/%'"
    : "";

  return exclude ? `${clause} ${exclude}` : clause;
}

/** --- Local FX price map --- */
const FX_PRICE_MAP: Record<string, FxMapRow> = {
  eur: { ticker: "EURUSD=X", defaultSize: 125_000 },
  gbp: { ticker: "GBPUSD=X", defaultSize: 62_500 },
  aud: { ticker: "AUDUSD=X", defaultSize: 100_000 },
  nzd: { ticker: "NZDUSD=X", defaultSize: 100_000 },
  cad: { ticker: "USDCAD=X", inverse: true, defaultSize: 100_000 },
  chf: { ticker: "USDCHF=X", inverse: true, defaultSize: 125_000 },
  jpy: { ticker: "USDJPY=X", inverse: true, defaultSize: 12_500_000 },
};

/** ---------------- In-memory caches ---------------- */

type CacheEntry<T> = { value: T; expiresAt: number };

// Use unique symbols to avoid name clashes across hot-reloads
const PRICE_CACHE_KEY = Symbol.for("__cotPriceCache");
const POINTS_CACHE_KEY = Symbol.for("__cotPointsCache");

type GlobalWithCaches = typeof globalThis & {
  [PRICE_CACHE_KEY]?: Map<string, CacheEntry<number>>;
  [POINTS_CACHE_KEY]?: Map<string, CacheEntry<CotPointUSD[]>>;
};

const g = globalThis as GlobalWithCaches;

g[PRICE_CACHE_KEY] ??= new Map<string, CacheEntry<number>>();
g[POINTS_CACHE_KEY] ??= new Map<string, CacheEntry<CotPointUSD[]>>();

const priceCache = g[PRICE_CACHE_KEY]!;
const pointsCache = g[POINTS_CACHE_KEY]!;

const nowMs = () => Date.now();
function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = map.get(key);
  if (!e) return null;
  if (e.expiresAt < nowMs()) {
    map.delete(key);
    return null;
  }
  return e.value;
}
function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlSec: number) {
  map.set(key, { value, expiresAt: nowMs() + ttlSec * 1000 });
}

// Historic prices (immutable) -> 30 days cache
async function yahooCloseCached(ticker: string, date: string): Promise<number | null> {
  const key = `${ticker}:${date}`;
  const hit = cacheGet<number>(priceCache, key);
  if (hit != null) return hit;
  const px = await yahooCloseOn(ticker, date);
  if (px != null && Number.isFinite(px)) cacheSet<number>(priceCache, key, px, 30 * 24 * 3600);
  return px;
}

/** ---------- Handler ---------- */

export async function GET(
  req: NextRequest,
  { params }: { params: { market: string } }
) {
  const { market } = params;
  const info = resolveMarket(market);
  if (!info) return NextResponse.json({ error: "Unknown market" }, { status: 404 });

  const u = req.nextUrl;
  const { from, to, label } = resolveRange(new URL(u.toString()));
  const wantUsd = (u.searchParams.get("basis") || "").toLowerCase() === "usd";

  // ----- Build CFTC request -----
  const url = new URL(CFTC_URL);
  url.searchParams.set(
    "$select",
    [
      "report_date_as_yyyy_mm_dd",
      "market_and_exchange_names",
      "contract_market_name",
      "noncomm_positions_long_all",
      "noncomm_positions_short_all",
      "comm_positions_long_all",
      "comm_positions_short_all",
      "nonrept_positions_long_all",
      "nonrept_positions_short_all",
      "open_interest_all",
    ].join(", ")
  );

  const strictClause = maybeStrictNameClause(info.cftcName);
  const nameClause = strictClause ?? broadNameClause(info.cftcName);

  const where = [
    `report_date_as_yyyy_mm_dd >= '${from}T00:00:00.000'`,
    `report_date_as_yyyy_mm_dd <= '${to}T00:00:00.000'`,
    nameClause,
  ].join(" AND ");

  url.searchParams.set("$where", where);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd asc");
  url.searchParams.set("$limit", "50000");

  let rows: CftcRow[] = [];
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: TTL_SECONDS },
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `CFTC ${res.status}: ${text}` }, { status: 502 });
    rows = text ? (JSON.parse(text) as CftcRow[]) : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Fetch/parse error: ${msg}` }, { status: 502 });
  }

  if (!rows.length) {
    const baseShort = info.cftcName.split(" - ")[0];
    const shortCandidates = Array.from(new Set([baseShort, baseShort.replace(/\s+STERLING\b/i, "")]));
    return NextResponse.json({ error: `No data for ${shortCandidates.join(" / ")}` }, { status: 404 });
  }

  // ----- Aggregate -----
  type Agg = { lcL: number; lcS: number; cmL: number; cmS: number; smL: number; smS: number; oi: number };
  const byDate = new Map<string, Agg>();

  for (const r of rows) {
    const d = (r.report_date_as_yyyy_mm_dd ?? "").toString().slice(0, 10);
    if (!d) continue;
    const cur = byDate.get(d) ?? { lcL: 0, lcS: 0, cmL: 0, cmS: 0, smL: 0, smS: 0, oi: 0 };
    cur.lcL += num(r.noncomm_positions_long_all);
    cur.lcS += num(r.noncomm_positions_short_all);
    cur.cmL += num(r.comm_positions_long_all);
    cur.cmS += num(r.comm_positions_short_all);
    cur.smL += num(r.nonrept_positions_long_all);
    cur.smS += num(r.nonrept_positions_short_all);
    cur.oi += num(r.open_interest_all);
    byDate.set(d, cur);
  }

  const dates = Array.from(byDate.keys()).sort();

  const large: number[] = [];
  const small: number[] = [];
  const comm: number[] = [];
  const open_interest: (number | null)[] = [];
  const ls_large: number[] = [];
  const ls_small: number[] = [];
  const ls_comm: number[] = [];

  for (const d of dates) {
    const a = byDate.get(d)!;
    const lNet = a.lcL - a.lcS;
    const sNet = a.smL - a.smS;
    const cNet = a.cmL - a.cmS;
    large.push(lNet);
    small.push(sNet);
    comm.push(cNet);
    open_interest.push(Number.isFinite(a.oi) ? a.oi : null);
    ls_large.push(a.lcS !== 0 ? a.lcL / a.lcS : Number.NaN);
    ls_small.push(a.smS !== 0 ? a.smL / a.smS : Number.NaN);
    ls_comm.push(a.cmS !== 0 ? a.cmL / a.cmS : Number.NaN);
  }

  const recent = dates
    .slice()
    .reverse()
    .map((d) => {
      const a = byDate.get(d)!;
      return {
        date: d,
        open_interest: Number.isFinite(a.oi) ? a.oi : null,
        large_spec_net: a.lcL - a.lcS,
        small_traders_net: a.smL - a.smS,
        commercials_net: a.cmL - a.cmS,
        large_spec_long: a.lcL,
        large_spec_short: a.lcS,
      };
    });

  type Payload = CotSeries & {
    points?: CotPointUSD[];
    // soft metadata
    range?: { from: string; to: string; label: string };
  };

  const payload: Payload = {
    market: { key: info.key, code: info.code, name: info.name },
    dates,
    large,
    small,
    comm,
    ls_large,
    ls_small,
    ls_comm,
    open_interest,
    recent,
    updated: new Date().toISOString(),
    range: { from, to, label },
  };

  // ---------- USD notional (generic: FX + all markets with CONTRACT_SPECS) ----------
  if (wantUsd) {
    const pointsKey = `${info.key}:${from}:${to}:usd:v2`; // bump cache key when logic changes
    const hit = cacheGet<CotPointUSD[]>(pointsCache, pointsKey);
    if (hit) {
      payload.points = hit;
      return NextResponse.json(payload, { headers: RESPONSE_CACHE_HEADERS });
    }

    const spec = (CONTRACT_SPECS as Record<string, PriceSpec | undefined>)[info.key];
    const fx = FX_PRICE_MAP[info.key];

    // helper to build points from a Yahoo ticker
    async function seriesFromYahoo(ticker: string, invert = false, multiplier = 1): Promise<CotPointUSD[]> {
      let lastPx: number | null = null;
      const pts = await Promise.all(
        dates.map(async (d) => {
          const a = byDate.get(d)!;
          const netContracts = a.lcL - a.lcS;

          let raw = await yahooCloseCached(ticker, d);
          if (raw == null && lastPx != null) raw = lastPx;
          if (raw == null || !Number.isFinite(raw)) return { date: d, netNotionalUSD: null };

          const px = invert ? Number(inv(raw)) : Number(raw);
          if (!Number.isFinite(px)) return { date: d, netNotionalUSD: null };

          lastPx = px;
          const csize = spec?.contractSize ?? 1;
          const pmult = spec?.priceMultiplier ?? multiplier ?? 1;
          const notional = netContracts * csize * (px * pmult);
          return { date: d, netNotionalUSD: Number.isFinite(notional) ? Math.round(notional) : null };
        })
      );
      return pts;
    }

    let points: CotPointUSD[] | null = null;

    if (fx?.ticker) {
      // FX path (uses inverse flags for CAD/CHF/JPY)
      points = await seriesFromYahoo(fx.ticker, !!fx.inverse, 1);
    } else if (spec?.price?.kind === "yahoo" && spec.price.symbol) {
      // Generic path for indices/commodities with a Yahoo symbol in CONTRACT_SPECS
      points = await seriesFromYahoo(spec.price.symbol, false, spec.priceMultiplier ?? 1);
    }

    if (!points) {
      points = dates.map((d) => ({ date: d, netNotionalUSD: null }));
    }

    payload.points = points;
    cacheSet<CotPointUSD[]>(pointsCache, pointsKey, points, TTL_SECONDS);
  }

  return NextResponse.json(payload, { headers: RESPONSE_CACHE_HEADERS });
}
