import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveMarket } from "@/lib/cot/markets";

const MARKET_KEY_TO_DB_CODE: Record<string, string> = {
  eur: "6E",
  jpy: "6J",
  gbp: "6B",
  aud: "6A",
  nzd: "6N",
  cad: "6C",
  chf: "6S",
  mxn: "6M",

  gold: "XAU",
  silver: "XAG",
  copper: "HG",

  wti: "CL",
  brent: "BRN",
  rbob: "RB",
  ng: "NG",

  corn: "ZC",
  wheat: "ZW",
  soy: "ZS",
  sugar11: "SB",
  coffee: "KC",
  cocoa: "CC",
  lc: "LE",
  lh: "HE",

  spx: "SPX",
  ndx: "NDX",
  djia: "DJI",
  btc: "BTC",
};

const FX_DB_CODES = new Set(["6E", "6J", "6B", "6A", "6N", "6C", "6S", "6M"]);

function cutoffFor(range: string): string | null {
  const now = new Date();

  switch (range) {
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

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function biasFromNet(
  netUsd: number | null,
  netContracts: number | null
): "bullish" | "bearish" | "neutral" | null {
  const v = netUsd ?? netContracts;
  if (v == null) return null;
  if (v > 0) return "bullish";
  if (v < 0) return "bearish";
  return "neutral";
}

function isoDate(v: string): string {
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

function calcReactionType(
  bias: "bullish" | "bearish" | "neutral" | null,
  movePct: number | null
): string | null {
  if (!bias || bias === "neutral" || movePct == null || movePct === 0) return null;
  if (bias === "bullish") return movePct > 0 ? "confirmation" : "fade";
  if (bias === "bearish") return movePct < 0 ? "confirmation" : "fade";
  return null;
}

type UnifiedDbRow = {
  report_date: string;
  category: string | null;
  price_symbol: string | null;
  report_price: number | null;

  long_noncommercial: number | null;
  short_noncommercial: number | null;
  net_noncommercial: number | null;

  long_commercial: number | null;
  short_commercial: number | null;
  net_commercial: number | null;

  long_nonreportable: number | null;
  short_nonreportable: number | null;
  net_nonreportable: number | null;

  oi_total: number | null;

  long_noncommercial_usd: number | null;
  short_noncommercial_usd: number | null;
  net_noncommercial_usd: number | null;

  long_commercial_usd: number | null;
  short_commercial_usd: number | null;
  net_commercial_usd: number | null;

  long_nonreportable_usd: number | null;
  short_nonreportable_usd: number | null;
  net_nonreportable_usd: number | null;
};

type FxReactionRow = {
  report_date: string;
  position_bias: string | null;
  report_price: number | null;
  release_price: number | null;
  reaction_report_price: number | null;
  reaction_release_price: number | null;
  move_pct_report_to_release: number | null;
  price_direction: string | null;
  reaction_type: string | null;
};

type PriceRow = {
  market_code: string;
  price_date: string;
  close: number | null;
};

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

    const dbCode = MARKET_KEY_TO_DB_CODE[info.key];
    if (!dbCode) {
      return NextResponse.json(
        { error: "No DB mapping for market" },
        { status: 404 }
      );
    }

    const isFx = FX_DB_CODES.has(dbCode);
    const range = (req.nextUrl.searchParams.get("range") ?? "5y").toLowerCase();
    const startDate = cutoffFor(range);

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("cot_all_usd_notional")
      .select(`
        report_date,
        category,
        price_symbol,
        report_price,
        long_noncommercial,
        short_noncommercial,
        net_noncommercial,
        long_commercial,
        short_commercial,
        net_commercial,
        long_nonreportable,
        short_nonreportable,
        net_nonreportable,
        oi_total,
        long_noncommercial_usd,
        short_noncommercial_usd,
        net_noncommercial_usd,
        long_commercial_usd,
        short_commercial_usd,
        net_commercial_usd,
        long_nonreportable_usd,
        short_nonreportable_usd,
        net_nonreportable_usd
      `)
      .eq("market_code", dbCode)
      .order("report_date", { ascending: true });

    if (startDate) {
      query = query.gte("report_date", startDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as UnifiedDbRow[];

    if (!rows.length) {
      return NextResponse.json({ error: "No rows found" }, { status: 404 });
    }

    let reactionMap = new Map<string, FxReactionRow>();

    if (isFx) {
      let reactionQuery = supabase
        .from("cot_fx_reaction_v3_mv")
        .select(`
          report_date,
          position_bias,
          report_price,
          release_price,
          reaction_report_price,
          reaction_release_price,
          move_pct_report_to_release,
          price_direction,
          reaction_type
        `)
        .eq("market_code", dbCode)
        .order("report_date", { ascending: true });

      if (startDate) {
        reactionQuery = reactionQuery.gte("report_date", startDate);
      }

      const { data: reactionRows, error: reactionError } = await reactionQuery;
      if (reactionError) throw new Error(reactionError.message);

      reactionMap = new Map(
        ((reactionRows ?? []) as FxReactionRow[]).map((r) => [
          isoDate(r.report_date),
          r,
        ])
      );
    }

    let nonFxPriceMap = new Map<string, number | null>();

    if (!isFx) {
      const releaseDates = rows.map((r) => getReleaseDate(isoDate(r.report_date)));
      const reportDates = rows.map((r) => isoDate(r.report_date));
      const allDates = [...reportDates, ...releaseDates].sort();

      const minDate = allDates[0] ?? null;
      const maxDate = allDates.at(-1) ?? null;

      if (minDate && maxDate) {
        const { data: priceRows, error: priceError } = await supabase
          .from("cot_market_prices_daily")
          .select("market_code, price_date, close")
          .eq("market_code", dbCode)
          .gte("price_date", minDate)
          .lte("price_date", maxDate)
          .order("price_date", { ascending: true });

        if (priceError) throw new Error(priceError.message);

        for (const row of (priceRows ?? []) as PriceRow[]) {
          nonFxPriceMap.set(
            `${row.market_code}__${isoDate(row.price_date)}`,
            toNum(row.close)
          );
        }
      }
    }

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

    let price_symbol: string | null = null;

    for (const row of rows) {
      const rowDate = isoDate(row.report_date);

      const lcL = toNum(row.long_noncommercial) ?? 0;
      const lcS = toNum(row.short_noncommercial) ?? 0;
      const cmL = toNum(row.long_commercial) ?? 0;
      const cmS = toNum(row.short_commercial) ?? 0;
      const smL = toNum(row.long_nonreportable) ?? 0;
      const smS = toNum(row.short_nonreportable) ?? 0;

      const netNc = toNum(row.net_noncommercial) ?? lcL - lcS;
      const netSm = toNum(row.net_nonreportable) ?? smL - smS;
      const netCm = toNum(row.net_commercial) ?? cmL - cmS;
      const netNcUsd = toNum(row.net_noncommercial_usd);

      dates.push(rowDate);
      large.push(netNc);
      small.push(netSm);
      comm.push(netCm);

      ls_large.push(lcS !== 0 ? lcL / lcS : Number.NaN);
      ls_small.push(smS !== 0 ? smL / smS : Number.NaN);
      ls_comm.push(cmS !== 0 ? cmL / cmS : Number.NaN);

      open_interest.push(toNum(row.oi_total));

      large_usd.push(netNcUsd);
      small_usd.push(toNum(row.net_nonreportable_usd));
      comm_usd.push(toNum(row.net_commercial_usd));

      if (!price_symbol && row.price_symbol) {
        price_symbol = row.price_symbol;
      }

      const baseBias = biasFromNet(netNcUsd, netNc);

      if (isFx) {
        const rxn = reactionMap.get(rowDate);

        const fxReportPrice = toNum(rxn?.reaction_report_price);
        const fxReleasePrice = toNum(rxn?.reaction_release_price);
        const fxMovePct = calcMovePct(fxReportPrice, fxReleasePrice);
        const fxDirection = calcPriceDirection(fxMovePct);
        const fxBias =
          (rxn?.position_bias as "bullish" | "bearish" | "neutral" | null) ??
          baseBias;
        const fxReaction = calcReactionType(fxBias, fxMovePct);

        report_price.push(fxReportPrice);
        release_price.push(fxReleasePrice);
        bias.push(fxBias);
        move_pct.push(fxMovePct);
        price_direction.push(fxDirection);
        reaction.push(fxReaction);
        positioning.push(null);
      } else {
        const releaseDate = getReleaseDate(rowDate);

        const computedReportPrice =
          nonFxPriceMap.get(`${dbCode}__${rowDate}`) ?? toNum(row.report_price);

        const computedReleasePrice =
          nonFxPriceMap.get(`${dbCode}__${releaseDate}`) ?? null;

        const computedMovePct = calcMovePct(computedReportPrice, computedReleasePrice);
        const computedDirection = calcPriceDirection(computedMovePct);
        const computedReaction = calcReactionType(baseBias, computedMovePct);

        report_price.push(computedReportPrice);
        release_price.push(computedReleasePrice);
        bias.push(baseBias);
        move_pct.push(computedMovePct);
        price_direction.push(computedDirection);
        reaction.push(computedReaction);
        positioning.push(null);
      }
    }

    const recentBase = rows
      .slice()
      .reverse()
      .slice(0, 12)
      .map((row) => {
        const rowDate = isoDate(row.report_date);

        const netNc = toNum(row.net_noncommercial) ?? 0;
        const netNcUsd = toNum(row.net_noncommercial_usd);
        const baseBias = biasFromNet(netNcUsd, netNc);

        if (isFx) {
          const rxn = reactionMap.get(rowDate);

          const fxReportPrice = toNum(rxn?.reaction_report_price);
          const fxReleasePrice = toNum(rxn?.reaction_release_price);
          const fxMovePct = calcMovePct(fxReportPrice, fxReleasePrice);
          const fxDirection = calcPriceDirection(fxMovePct);
          const fxBias =
            (rxn?.position_bias as "bullish" | "bearish" | "neutral" | null) ??
            baseBias;
          const fxReaction = calcReactionType(fxBias, fxMovePct);

          return {
            date: rowDate,
            open_interest: toNum(row.oi_total),

            large_spec_net: netNc,
            large_spec_long: toNum(row.long_noncommercial),
            large_spec_short: toNum(row.short_noncommercial),

            small_traders_net: toNum(row.net_nonreportable) ?? 0,
            commercials_net: toNum(row.net_commercial) ?? 0,

            report_price: fxReportPrice,
            release_price: fxReleasePrice,

            bias: fxBias,
            move_pct_report_to_release: fxMovePct,
            price_direction: fxDirection,
            reaction_type: fxReaction,

            large_spec_net_usd: netNcUsd,
            small_traders_net_usd: toNum(row.net_nonreportable_usd),
            commercials_net_usd: toNum(row.net_commercial_usd),
          };
        }

        const releaseDate = getReleaseDate(rowDate);

        const computedReportPrice =
          nonFxPriceMap.get(`${dbCode}__${rowDate}`) ?? toNum(row.report_price);

        const computedReleasePrice =
          nonFxPriceMap.get(`${dbCode}__${releaseDate}`) ?? null;

        const computedMovePct = calcMovePct(computedReportPrice, computedReleasePrice);
        const computedDirection = calcPriceDirection(computedMovePct);
        const computedReaction = calcReactionType(baseBias, computedMovePct);

        return {
          date: rowDate,
          open_interest: toNum(row.oi_total),

          large_spec_net: netNc,
          large_spec_long: toNum(row.long_noncommercial),
          large_spec_short: toNum(row.short_noncommercial),

          small_traders_net: toNum(row.net_nonreportable) ?? 0,
          commercials_net: toNum(row.net_commercial) ?? 0,

          report_price: computedReportPrice,
          release_price: computedReleasePrice,

          bias: baseBias,
          move_pct_report_to_release: computedMovePct,
          price_direction: computedDirection,
          reaction_type: computedReaction,

          large_spec_net_usd: netNcUsd,
          small_traders_net_usd: toNum(row.net_nonreportable_usd),
          commercials_net_usd: toNum(row.net_commercial_usd),
        };
      });

    const recent = recentBase.map((r, i) => {
      const next = recentBase[i + 1];
      const dLarge = next ? r.large_spec_net - next.large_spec_net : undefined;

      let positioningLabel: string | null = null;
      if (r.bias === "bullish") {
        positioningLabel =
          dLarge == null || dLarge === 0
            ? "Flat Bullish"
            : dLarge > 0
            ? "Increasing Bullish"
            : "Less Bullish";
      } else if (r.bias === "bearish") {
        positioningLabel =
          dLarge == null || dLarge === 0
            ? "Flat Bearish"
            : dLarge < 0
            ? "Increasing Bearish"
            : "Less Bearish";
      } else if (r.bias === "neutral") {
        positioningLabel = "Neutral";
      }

      return {
        ...r,
        positioning: positioningLabel,
        d_large: dLarge,
        d_large_long:
          next &&
          r.large_spec_long != null &&
          next.large_spec_long != null
            ? r.large_spec_long - next.large_spec_long
            : undefined,
        d_large_short:
          next &&
          r.large_spec_short != null &&
          next.large_spec_short != null
            ? r.large_spec_short - next.large_spec_short
            : undefined,
        d_small: next ? r.small_traders_net - next.small_traders_net : undefined,
        d_comm: next ? r.commercials_net - next.commercials_net : undefined,
        d_oi:
          next && r.open_interest != null && next.open_interest != null
            ? r.open_interest - next.open_interest
            : undefined,
        d_large_usd:
          next &&
          r.large_spec_net_usd != null &&
          next.large_spec_net_usd != null
            ? r.large_spec_net_usd - next.large_spec_net_usd
            : undefined,
        d_small_usd:
          next &&
          r.small_traders_net_usd != null &&
          next.small_traders_net_usd != null
            ? r.small_traders_net_usd - next.small_traders_net_usd
            : undefined,
        d_comm_usd:
          next &&
          r.commercials_net_usd != null &&
          next.commercials_net_usd != null
            ? r.commercials_net_usd - next.commercials_net_usd
            : undefined,
      };
    });

    // Legacy shape kept for older currency strength chart compatibility
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
        dbCode,
        isFx,
        fx_symbol: isFx ? price_symbol : null,
        price_symbol,
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
        label: range,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 500 });
  }
}