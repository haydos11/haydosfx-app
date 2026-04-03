import { NextRequest, NextResponse } from "next/server";
import { resolveMarket } from "@/lib/cot/markets";
import { CONTRACT_SPECS } from "@/lib/cot/contracts";
import { yahooCloseOn, inv } from "@/lib/pricing/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const FX_KEYS = new Set(["eur", "jpy", "gbp", "aud", "nzd", "cad", "chf", "mxn"]);
const INVERT_IF = new Set<string>(["JPY=X", "CAD=X", "MXN=X"]);

type CftcRow = {
  report_date_as_yyyy_mm_dd?: string;
  market_and_exchange_names?: string;
  contract_market_name?: string;

  noncomm_positions_long_all?: string | number | null;
  noncomm_positions_short_all?: string | number | null;
  comm_positions_long_all?: string | number | null;
  comm_positions_short_all?: string | number | null;
  nonrept_positions_long_all?: string | number | null;
  nonrept_positions_short_all?: string | number | null;
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

type BiasKind = "bullish" | "bearish" | "neutral" | null;
type SentimentKind =
  | "increasing_bullish"
  | "less_bullish"
  | "flat_bullish"
  | "increasing_bearish"
  | "less_bearish"
  | "flat_bearish"
  | "neutral"
  | null;

type RecentRow = {
  date: string;
  open_interest: number | null;

  large_spec_net: number;
  large_spec_long: number | null;
  large_spec_short: number | null;

  small_traders_net: number;
  small_traders_long: number | null;
  small_traders_short: number | null;

  commercials_net: number;
  commercials_long: number | null;
  commercials_short: number | null;

  report_price: number | null;
  release_price: number | null;

  bias: BiasKind;
  positioning: string | null;
  move_pct_report_to_release: number | null;
  price_direction: string | null;
  reaction_type: string | null;

  large_spec_net_usd: number | null;
  small_traders_net_usd: number | null;
  commercials_net_usd: number | null;

  usd_per_contract: number | null;

  d_large?: number;
  d_large_long?: number;
  d_large_short?: number;
  d_small?: number;
  d_comm?: number;
  d_oi?: number;
  d_large_usd?: number;
  d_small_usd?: number;
  d_comm_usd?: number;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function esc(s: string) {
  return s.replace(/'/g, "''");
}

function isoDate(v: string) {
  return String(v).slice(0, 10);
}

function addUtcDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getReleaseDate(reportDate: string): string {
  return addUtcDays(reportDate, 3);
}

function cutoffFor(range: string): string | null {
  const now = new Date();

  switch ((range || "").toLowerCase()) {
    case "3m":
      now.setUTCMonth(now.getUTCMonth() - 3);
      return now.toISOString().slice(0, 10);
    case "1y":
      now.setUTCFullYear(now.getUTCFullYear() - 1);
      return now.toISOString().slice(0, 10);
    case "ytd":
      return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
        .toISOString()
        .slice(0, 10);
    case "3y":
      now.setUTCFullYear(now.getUTCFullYear() - 3);
      return now.toISOString().slice(0, 10);
    case "5y":
      now.setUTCFullYear(now.getUTCFullYear() - 5);
      return now.toISOString().slice(0, 10);
    case "max":
      return null;
    default:
      now.setUTCFullYear(now.getUTCFullYear() - 5);
      return now.toISOString().slice(0, 10);
  }
}

function structuralBiasFromNet(
  netUsd: number | null,
  netContracts: number | null
): BiasKind {
  const v = netUsd ?? netContracts;
  if (v == null) return null;
  if (v > 0) return "bullish";
  if (v < 0) return "bearish";
  return "neutral";
}

function classifySentiment(
  structuralBias: BiasKind,
  deltaNet: number | null | undefined
): SentimentKind {
  if (!structuralBias || structuralBias === "neutral") return "neutral";
  if (deltaNet == null || !Number.isFinite(deltaNet) || deltaNet === 0) {
    return structuralBias === "bullish" ? "flat_bullish" : "flat_bearish";
  }

  if (structuralBias === "bullish") {
    return deltaNet > 0 ? "increasing_bullish" : "less_bullish";
  }

  return deltaNet < 0 ? "increasing_bearish" : "less_bearish";
}

function sentimentLabel(sentiment: SentimentKind): string | null {
  switch (sentiment) {
    case "increasing_bullish":
      return "Increasing Bullish";
    case "less_bullish":
      return "Less Bullish";
    case "flat_bullish":
      return "Flat Bullish";
    case "increasing_bearish":
      return "Increasing Bearish";
    case "less_bearish":
      return "Less Bearish";
    case "flat_bearish":
      return "Flat Bearish";
    case "neutral":
      return "Neutral";
    default:
      return null;
  }
}

function calcMovePct(
  reportPrice: number | null,
  releasePrice: number | null
): number | null {
  if (
    reportPrice == null ||
    releasePrice == null ||
    !Number.isFinite(reportPrice) ||
    !Number.isFinite(releasePrice) ||
    reportPrice === 0
  ) {
    return null;
  }

  return ((releasePrice - reportPrice) / reportPrice) * 100;
}

function calcPriceDirection(movePct: number | null): string | null {
  if (movePct == null) return null;
  if (movePct > 0) return "up";
  if (movePct < 0) return "down";
  return "flat";
}

function calcReactionTypeFromSentiment(
  sentiment: SentimentKind,
  movePct: number | null
): string | null {
  if (sentiment == null || sentiment === "neutral" || movePct == null || movePct === 0) {
    return null;
  }

  const bullishImpulse =
    sentiment === "increasing_bullish" ||
    sentiment === "less_bearish" ||
    sentiment === "flat_bullish";

  const bearishImpulse =
    sentiment === "increasing_bearish" ||
    sentiment === "less_bullish" ||
    sentiment === "flat_bearish";

  if (bullishImpulse) {
    return movePct > 0 ? "confirmation" : "fade";
  }

  if (bearishImpulse) {
    return movePct < 0 ? "confirmation" : "fade";
  }

  return null;
}

type StrictSpec = {
  longNames: string[];
  shortNames: string[];
  excludeLike?: string[];
};

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

function maybeStrictWhere(cftcName: string): string | undefined {
  const upper = cftcName.toUpperCase().trim();
  const spec = STRICT_LIST.find((s) =>
    s.longNames.some((ln) => ln.toUpperCase() === upper)
  );
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
        .concat(
          spec.shortNames.map(
            (sn) => `UPPER(contract_market_name) = '${esc(sn).toUpperCase()}'`
          )
        )
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

function broadWhere(cftcName: string) {
  const longName = cftcName;
  const baseShort = longName.split(" - ")[0];
  const shortCandidates = Array.from(
    new Set([baseShort, baseShort.replace(/\s+STERLING\b/i, "")])
  );

  return (
    "(" +
    shortCandidates
      .map(
        (s) =>
          `(contract_market_name = '${esc(s)}' OR UPPER(contract_market_name) LIKE '${esc(
            s
          ).toUpperCase()}%')`
      )
      .join(" OR ") +
    ` OR UPPER(market_and_exchange_names) LIKE '${esc(longName).toUpperCase()}%'` +
    ") AND " +
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

async function fetchHistoricalRows(
  cftcName: string,
  startDate: string | null
): Promise<CftcRow[]> {
  const select = [
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
  ].join(", ");

  const strictWhere = maybeStrictWhere(cftcName);
  const baseWhere = strictWhere ?? broadWhere(cftcName);
  const where = startDate
    ? `(${baseWhere}) AND report_date_as_yyyy_mm_dd >= '${esc(startDate)}'`
    : baseWhere;

  const url =
    `${CFTC_URL}?` +
    `$select=${encodeURIComponent(select)}` +
    `&$where=${encodeURIComponent(where)}` +
    `&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd ASC")}` +
    `&$limit=5000`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`CFTC ${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as CftcRow[];
}

function buildPriceCacheKey(spec: ContractSpec, date: string): string {
  if (spec.price.kind === "fixedUSD") return `fixedUSD:${date}`;
  return `${spec.price.symbol}:${date}`;
}

async function getUsdPerUnitCached(
  spec: ContractSpec,
  date: string,
  cache: Map<string, number | null>
): Promise<number | null> {
  const key = buildPriceCacheKey(spec, date);

  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  let value: number | null = null;

  if (spec.price.kind === "fixedUSD") {
    value = 1;
  } else {
    let px = await yahooCloseOn(spec.price.symbol, date);
    if (px != null && INVERT_IF.has(spec.price.symbol)) {
      px = inv(px);
    }
    value = px ?? null;
  }

  cache.set(key, value);
  return value;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ market: string }> }
) {
  try {
    const { market } = await context.params;

    if (!market) {
      return NextResponse.json({ error: "Missing market param" }, { status: 400 });
    }

    const info = resolveMarket(market);
    if (!info) {
      return NextResponse.json({ error: "Unknown market" }, { status: 404 });
    }

    const range = (req.nextUrl.searchParams.get("range") ?? "5y").toLowerCase();
    const startDate = cutoffFor(range);

    const spec = (CONTRACT_SPECS as Record<string, ContractSpec | undefined>)[info.key];
    if (!spec) {
      return NextResponse.json({ error: `No contract spec for ${info.key}` }, { status: 404 });
    }

    const rows = await fetchHistoricalRows(info.cftcName, startDate);

    if (!rows.length) {
      return NextResponse.json({ error: "No rows found" }, { status: 404 });
    }

    const isFx = FX_KEYS.has(info.key);
    const pm = spec.priceMultiplier ?? 1;
    const priceCache = new Map<string, number | null>();

    const dates: string[] = [];
    const large: number[] = [];
    const small: number[] = [];
    const comm: number[] = [];
    const ls_large: number[] = [];
    const ls_small: number[] = [];
    const ls_comm: number[] = [];
    const open_interest: (number | null)[] = [];

    const report_price: (number | null)[] = [];
    const release_price: (number | null)[] = [];

    const large_usd: (number | null)[] = [];
    const small_usd: (number | null)[] = [];
    const comm_usd: (number | null)[] = [];

    const bias: (string | null)[] = [];
    const positioning: (string | null)[] = [];
    const move_pct: (number | null)[] = [];
    const price_direction: (string | null)[] = [];
    const reaction: (string | null)[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const prevRow = i > 0 ? rows[i - 1] : null;

      const date = isoDate(row.report_date_as_yyyy_mm_dd ?? "");
      if (!date) continue;

      const ncLong = num(row.noncomm_positions_long_all) ?? 0;
      const ncShort = num(row.noncomm_positions_short_all) ?? 0;
      const cmLong = num(row.comm_positions_long_all) ?? 0;
      const cmShort = num(row.comm_positions_short_all) ?? 0;
      const smLong = num(row.nonrept_positions_long_all) ?? 0;
      const smShort = num(row.nonrept_positions_short_all) ?? 0;

      const ncNet = ncLong - ncShort;
      const cmNet = cmLong - cmShort;
      const smNet = smLong - smShort;

      const prevNcNet =
        prevRow == null
          ? null
          : (num(prevRow.noncomm_positions_long_all) ?? 0) -
            (num(prevRow.noncomm_positions_short_all) ?? 0);

      const dLarge = prevNcNet == null ? null : ncNet - prevNcNet;

      const releaseDate = getReleaseDate(date);

      const pxReport = await getUsdPerUnitCached(spec, date, priceCache);
      const pxRelease = await getUsdPerUnitCached(spec, releaseDate, priceCache);

      const ncUsd = pxReport == null ? null : ncNet * spec.contractSize * pm * pxReport;
      const cmUsd = pxReport == null ? null : cmNet * spec.contractSize * pm * pxReport;
      const smUsd = pxReport == null ? null : smNet * spec.contractSize * pm * pxReport;

      const structuralBias = structuralBiasFromNet(ncUsd, ncNet);
      const sentiment = classifySentiment(structuralBias, dLarge);
      const mv = calcMovePct(pxReport, pxRelease);
      const dir = calcPriceDirection(mv);
      const rxn = calcReactionTypeFromSentiment(sentiment, mv);

      dates.push(date);
      large.push(ncNet);
      small.push(smNet);
      comm.push(cmNet);

      ls_large.push(ncShort !== 0 ? ncLong / ncShort : Number.NaN);
      ls_small.push(smShort !== 0 ? smLong / smShort : Number.NaN);
      ls_comm.push(cmShort !== 0 ? cmLong / cmShort : Number.NaN);
      open_interest.push(num(row.open_interest_all));

      report_price.push(pxReport);
      release_price.push(pxRelease);

      large_usd.push(ncUsd);
      small_usd.push(smUsd);
      comm_usd.push(cmUsd);

      bias.push(structuralBias);
      positioning.push(sentimentLabel(sentiment));
      move_pct.push(mv);
      price_direction.push(dir);
      reaction.push(rxn);
    }

    const recentBase = rows.slice().reverse().slice(0, 12);
    const recent: RecentRow[] = [];

    for (let i = 0; i < recentBase.length; i++) {
      const row = recentBase[i];
      const rowDate = isoDate(row.report_date_as_yyyy_mm_dd ?? "");

      const ncLong = num(row.noncomm_positions_long_all) ?? 0;
      const ncShort = num(row.noncomm_positions_short_all) ?? 0;
      const cmLong = num(row.comm_positions_long_all) ?? 0;
      const cmShort = num(row.comm_positions_short_all) ?? 0;
      const smLong = num(row.nonrept_positions_long_all) ?? 0;
      const smShort = num(row.nonrept_positions_short_all) ?? 0;

      const ncNet = ncLong - ncShort;
      const cmNet = cmLong - cmShort;
      const smNet = smLong - smShort;

      const pxReport = await getUsdPerUnitCached(spec, rowDate, priceCache);
      const pxRelease = await getUsdPerUnitCached(
        spec,
        getReleaseDate(rowDate),
        priceCache
      );

      const ncUsd = pxReport == null ? null : ncNet * spec.contractSize * pm * pxReport;
      const cmUsd = pxReport == null ? null : cmNet * spec.contractSize * pm * pxReport;
      const smUsd = pxReport == null ? null : smNet * spec.contractSize * pm * pxReport;

      const next = recentBase[i + 1];
      const nextNcNet =
        next == null
          ? null
          : (num(next.noncomm_positions_long_all) ?? 0) -
            (num(next.noncomm_positions_short_all) ?? 0);

      const dLarge = nextNcNet == null ? undefined : ncNet - nextNcNet;

      const structuralBias = structuralBiasFromNet(ncUsd, ncNet);
      const sentiment = classifySentiment(structuralBias, dLarge);
      const mv = calcMovePct(pxReport, pxRelease);
      const dir = calcPriceDirection(mv);
      const rxn = calcReactionTypeFromSentiment(sentiment, mv);

      recent.push({
        date: rowDate,
        open_interest: num(row.open_interest_all),

        large_spec_net: ncNet,
        large_spec_long: ncLong,
        large_spec_short: ncShort,

        small_traders_net: smNet,
        small_traders_long: smLong,
        small_traders_short: smShort,

        commercials_net: cmNet,
        commercials_long: cmLong,
        commercials_short: cmShort,

        report_price: pxReport,
        release_price: pxRelease,

        bias: structuralBias,
        positioning: sentimentLabel(sentiment),
        move_pct_report_to_release: mv,
        price_direction: dir,
        reaction_type: rxn,

        large_spec_net_usd: ncUsd,
        small_traders_net_usd: smUsd,
        commercials_net_usd: cmUsd,

        usd_per_contract: pxReport == null ? null : spec.contractSize * pm * pxReport,

        d_large:
          next == null
            ? undefined
            : ncNet -
              ((num(next.noncomm_positions_long_all) ?? 0) -
                (num(next.noncomm_positions_short_all) ?? 0)),
        d_large_long:
          next == null
            ? undefined
            : ncLong - (num(next.noncomm_positions_long_all) ?? 0),
        d_large_short:
          next == null
            ? undefined
            : ncShort - (num(next.noncomm_positions_short_all) ?? 0),
        d_small:
          next == null
            ? undefined
            : smNet -
              ((num(next.nonrept_positions_long_all) ?? 0) -
                (num(next.nonrept_positions_short_all) ?? 0)),
        d_comm:
          next == null
            ? undefined
            : cmNet -
              ((num(next.comm_positions_long_all) ?? 0) -
                (num(next.comm_positions_short_all) ?? 0)),
        d_oi:
          next == null
            ? undefined
            : (num(row.open_interest_all) ?? 0) - (num(next.open_interest_all) ?? 0),
        d_large_usd: undefined,
        d_small_usd: undefined,
        d_comm_usd: undefined,
      });
    }

    for (let i = 0; i < recent.length - 1; i++) {
      const curr = recent[i];
      const prev = recent[i + 1];

      curr.d_large_usd =
        curr.large_spec_net_usd != null && prev.large_spec_net_usd != null
          ? curr.large_spec_net_usd - prev.large_spec_net_usd
          : undefined;
      curr.d_small_usd =
        curr.small_traders_net_usd != null && prev.small_traders_net_usd != null
          ? curr.small_traders_net_usd - prev.small_traders_net_usd
          : undefined;
      curr.d_comm_usd =
        curr.commercials_net_usd != null && prev.commercials_net_usd != null
          ? curr.commercials_net_usd - prev.commercials_net_usd
          : undefined;
    }

    const points = dates.map((date, i) => ({
      date,
      netNotionalUSD: large_usd[i] ?? null,
    }));

    return NextResponse.json({
      points,
      market: {
        key: info.key,
        code: info.code,
        name: info.name,
        dbCode: info.code,
        isFx,
        fx_symbol: isFx && spec.price.kind === "yahoo" ? spec.price.symbol : null,
        price_symbol: spec.price.kind === "yahoo" ? spec.price.symbol : "USD",
      },
      dates,
      large,
      small,
      comm,
      ls_large,
      ls_small,
      ls_comm,
      open_interest,
      report_price,
      release_price,
      large_usd,
      small_usd,
      comm_usd,
      bias,
      positioning,
      move_pct,
      price_direction,
      reaction,
      recent,
      updated: new Date().toISOString(),
      range: {
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
        label: range,
      },
      source: "Socrata+Yahoo",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 500 });
  }
}