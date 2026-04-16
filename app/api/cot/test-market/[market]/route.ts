import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveMarket } from "@/lib/cot/markets";
import { requireApiPremium } from "@/lib/auth/require-api-premium";

const MARKET_KEY_TO_DB_CODE: Record<string, string> = {
  usd: "USD",

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

const FX_DB_CODES = new Set(["USD", "6E", "6J", "6B", "6A", "6N", "6C", "6S"]);

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

function isoDate(v: string): string {
  return String(v).slice(0, 10);
}

function safeDivide(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return null;
  }
  const out = a / b;
  return Number.isFinite(out) ? out : null;
}

function rocPct(curr: number | null, prev: number | null): number | null {
  if (
    curr == null ||
    prev == null ||
    !Number.isFinite(curr) ||
    !Number.isFinite(prev) ||
    prev === 0
  ) {
    return null;
  }
  return ((curr - prev) / Math.abs(prev)) * 100;
}

type ServingRow = {
  market_code: string;
  market_name: string;
  category: string | null;
  base_ccy: string | null;
  quote_ccy: string | null;
  is_fx: boolean;

  report_date: string;
  release_date: string | null;
  next_report_date: string | null;

  report_price: number | null;
  release_price: number | null;
  next_report_price: number | null;

  reaction_move_pct: number | null;
  release_to_next_report_move_pct: number | null;
  report_to_next_report_move_pct: number | null;

  reaction_direction: string | null;
  reaction_type: string | null;

  oi_total: number | null;

  long_noncommercial: number | null;
  short_noncommercial: number | null;
  long_commercial: number | null;
  short_commercial: number | null;
  long_nonreportable: number | null;
  short_nonreportable: number | null;

  net_noncommercial: number | null;
  net_commercial: number | null;
  net_nonreportable: number | null;

  d_oi_total: number | null;
  d_long_noncommercial: number | null;
  d_short_noncommercial: number | null;
  d_net_noncommercial: number | null;
  d_net_commercial: number | null;
  d_net_nonreportable: number | null;

  native_notional: number | null;
  usd_signed_exposure: number | null;

  net_noncommercial_pct_oi: number | null;
  net_commercial_pct_oi: number | null;
  net_nonreportable_pct_oi: number | null;

  position_bias: string | null;
  position_trend: string | null;
  sentiment_label: string | null;
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ market: string }> }
) {
  try {
    const gate = await requireApiPremium();
    if (!gate.ok) return gate.response;

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

    const isSyntheticUsd = info.key === "usd";
    const isFx = FX_DB_CODES.has(dbCode);
    const range = (req.nextUrl.searchParams.get("range") ?? "5y").toLowerCase();
    const startDate = cutoffFor(range);

    const recentCountRaw = Number(req.nextUrl.searchParams.get("recent") ?? "12");
    const recentCount = Number.isFinite(recentCountRaw)
      ? Math.max(12, Math.min(52, Math.floor(recentCountRaw)))
      : 12;

    const supabase = getSupabaseAdmin();

    const sourceTable = isSyntheticUsd
      ? "cot_usd_basket_history_serving"
      : "cot_market_history_serving";

    let query = supabase
      .from(sourceTable)
      .select("*")
      .eq("market_code", dbCode)
      .order("report_date", { ascending: true });

    if (startDate) {
      query = query.gte("report_date", startDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as ServingRow[];

    if (!rows.length) {
      return NextResponse.json(
        { error: `No rows found for ${info.key} (${dbCode})` },
        { status: 404 }
      );
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
    const indexed_report_price: (number | null)[] = [];
    const indexed_release_price: (number | null)[] = [];

    const large_usd: (number | null)[] = [];
    const small_usd: (number | null)[] = [];
    const comm_usd: (number | null)[] = [];

    const bias: (string | null)[] = [];
    const positioning: (string | null)[] = [];
    const move_pct: (number | null)[] = [];
    const price_direction: (string | null)[] = [];
    const reaction: (string | null)[] = [];

    const price_symbol = isSyntheticUsd
      ? "USD"
      : isFx
        ? rows[0]?.base_ccy ?? null
        : dbCode;

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

      const largeUsdExposure = toNum(row.usd_signed_exposure);
      const usdPerContract = safeDivide(largeUsdExposure, netNc);

      const smallUsdExposure =
        usdPerContract != null ? netSm * usdPerContract : null;
      const commUsdExposure =
        usdPerContract != null ? netCm * usdPerContract : null;

      dates.push(rowDate);
      large.push(netNc);
      small.push(netSm);
      comm.push(netCm);

      ls_large.push(lcS !== 0 ? lcL / lcS : Number.NaN);
      ls_small.push(smS !== 0 ? smL / smS : Number.NaN);
      ls_comm.push(cmS !== 0 ? cmL / cmS : Number.NaN);

      open_interest.push(toNum(row.oi_total));

      report_price.push(toNum(row.report_price));
      release_price.push(toNum(row.release_price));
      indexed_report_price.push(toNum(row.report_price));
      indexed_release_price.push(toNum(row.release_price));

      large_usd.push(largeUsdExposure);
      small_usd.push(smallUsdExposure);
      comm_usd.push(commUsdExposure);

      bias.push(row.position_bias);
      move_pct.push(toNum(row.reaction_move_pct));
      price_direction.push(row.reaction_direction);
      reaction.push(row.reaction_type);
      positioning.push(row.position_trend);
    }

    const recent = rows
      .slice()
      .reverse()
      .slice(0, recentCount)
      .map((row, idx, arr) => {
        const prevRow = arr[idx + 1] ?? null;

        const netNc = toNum(row.net_noncommercial);
        const netSm = toNum(row.net_nonreportable) ?? 0;
        const netCm = toNum(row.net_commercial) ?? 0;

        const currLargeUsdExposure = toNum(row.usd_signed_exposure);
        const currUsdPerContract = safeDivide(currLargeUsdExposure, netNc);

        const prevNetNc = prevRow ? toNum(prevRow.net_noncommercial) : null;
        const prevLargeUsdExposure = prevRow ? toNum(prevRow.usd_signed_exposure) : null;
        const prevUsdPerContract = safeDivide(prevLargeUsdExposure, prevNetNc);

        const smL = toNum(row.long_nonreportable);
        const smS = toNum(row.short_nonreportable);
        const cmL = toNum(row.long_commercial);
        const cmS = toNum(row.short_commercial);

        const prevSmL = prevRow ? toNum(prevRow.long_nonreportable) : null;
        const prevSmS = prevRow ? toNum(prevRow.short_nonreportable) : null;
        const prevCmL = prevRow ? toNum(prevRow.long_commercial) : null;
        const prevCmS = prevRow ? toNum(prevRow.short_commercial) : null;

        const smallGrossContracts = (smL ?? 0) + (smS ?? 0);
        const commercialsGrossContracts = (cmL ?? 0) + (cmS ?? 0);
        const largeGrossContracts =
          (toNum(row.long_noncommercial) ?? 0) + (toNum(row.short_noncommercial) ?? 0);

        const prevSmallGrossContracts =
          (prevSmL ?? 0) + (prevSmS ?? 0);
        const prevCommercialsGrossContracts =
          (prevCmL ?? 0) + (prevCmS ?? 0);

        const smallUsdExposure =
          currUsdPerContract != null ? netSm * currUsdPerContract : null;
        const commercialsUsdExposure =
          currUsdPerContract != null ? netCm * currUsdPerContract : null;

        const dSmall = toNum(row.d_net_nonreportable);
        const dComm = toNum(row.d_net_commercial);
        const dLarge = toNum(row.d_net_noncommercial);

        const dSmallUsd =
          currUsdPerContract != null && dSmall != null ? dSmall * currUsdPerContract : null;
        const dCommUsd =
          currUsdPerContract != null && dComm != null ? dComm * currUsdPerContract : null;
        const dLargeUsd =
          currUsdPerContract != null && dLarge != null ? dLarge * currUsdPerContract : null;

        const smallGrossUsd =
          currUsdPerContract != null ? smallGrossContracts * Math.abs(currUsdPerContract) : null;
        const commercialsGrossUsd =
          currUsdPerContract != null ? commercialsGrossContracts * Math.abs(currUsdPerContract) : null;
        const largeGrossUsd =
          currUsdPerContract != null
            ? largeGrossContracts * Math.abs(currUsdPerContract)
            : null;

        const prevSmallGrossUsd =
          prevUsdPerContract != null
            ? prevSmallGrossContracts * Math.abs(prevUsdPerContract)
            : null;
        const prevCommercialsGrossUsd =
          prevUsdPerContract != null
            ? prevCommercialsGrossContracts * Math.abs(prevUsdPerContract)
            : null;

        const dSmallGrossContracts =
          prevRow != null ? smallGrossContracts - prevSmallGrossContracts : null;
        const dCommercialsGrossContracts =
          prevRow != null ? commercialsGrossContracts - prevCommercialsGrossContracts : null;

        const dSmallGrossUsd =
          smallGrossUsd != null && prevSmallGrossUsd != null
            ? smallGrossUsd - prevSmallGrossUsd
            : null;
        const dCommercialsGrossUsd =
          commercialsGrossUsd != null && prevCommercialsGrossUsd != null
            ? commercialsGrossUsd - prevCommercialsGrossUsd
            : null;

        const smallGrossContractsRocPct = rocPct(
          smallGrossContracts,
          prevRow != null ? prevSmallGrossContracts : null
        );
        const commercialsGrossContractsRocPct = rocPct(
          commercialsGrossContracts,
          prevRow != null ? prevCommercialsGrossContracts : null
        );

        const smallGrossUsdRocPct = rocPct(smallGrossUsd, prevSmallGrossUsd);
        const commercialsGrossUsdRocPct = rocPct(
          commercialsGrossUsd,
          prevCommercialsGrossUsd
        );

        return {
          date: isoDate(row.report_date),
          release_date: row.release_date ? isoDate(row.release_date) : null,
          next_report_date: row.next_report_date ? isoDate(row.next_report_date) : null,

          open_interest: toNum(row.oi_total),

          large_spec_net: netNc ?? 0,
          large_spec_long: toNum(row.long_noncommercial),
          large_spec_short: toNum(row.short_noncommercial),

          small_traders_net: netSm,
          small_traders_long: smL,
          small_traders_short: smS,

          commercials_net: netCm,
          commercials_long: cmL,
          commercials_short: cmS,

          small_traders_gross_contracts: smallGrossContracts,
          commercials_gross_contracts: commercialsGrossContracts,
          large_spec_gross_contracts: largeGrossContracts,

          d_small_gross_contracts: dSmallGrossContracts,
          d_comm_gross_contracts: dCommercialsGrossContracts,

          small_gross_contracts_roc_pct: smallGrossContractsRocPct,
          comm_gross_contracts_roc_pct: commercialsGrossContractsRocPct,

          report_price: toNum(row.report_price),
          release_price: toNum(row.release_price),
          next_report_price: toNum(row.next_report_price),

          indexed_report_price: toNum(row.report_price),
          indexed_release_price: toNum(row.release_price),

          bias: row.position_bias,
          positioning: row.position_trend,

          move_pct_report_to_release: toNum(row.reaction_move_pct),
          move_pct_release_to_next_report: toNum(row.release_to_next_report_move_pct),
          move_pct_report_to_next_report: toNum(row.report_to_next_report_move_pct),

          price_direction: row.reaction_direction,
          reaction_type: row.reaction_type,

          large_spec_net_usd: currLargeUsdExposure,
          small_traders_net_usd: smallUsdExposure,
          commercials_net_usd: commercialsUsdExposure,

          large_spec_gross_usd: largeGrossUsd,
          small_traders_gross_usd: smallGrossUsd,
          commercials_gross_usd: commercialsGrossUsd,

          d_small_gross_usd: dSmallGrossUsd,
          d_comm_gross_usd: dCommercialsGrossUsd,

          small_gross_usd_roc_pct: smallGrossUsdRocPct,
          comm_gross_usd_roc_pct: commercialsGrossUsdRocPct,

          usd_per_contract: currUsdPerContract,
          prev_usd_per_contract: prevUsdPerContract,

          d_large: dLarge,
          d_large_long: toNum(row.d_long_noncommercial),
          d_large_short: toNum(row.d_short_noncommercial),
          d_small: dSmall,
          d_comm: dComm,
          d_oi: toNum(row.d_oi_total),
          d_large_usd: dLargeUsd,
          d_small_usd: dSmallUsd,
          d_comm_usd: dCommUsd,
        };
      });

    return NextResponse.json({
      market: {
        key: info.key,
        code: info.code,
        name: info.name,
        dbCode,
        isFx,
        fx_symbol: isSyntheticUsd ? "USD" : isFx ? price_symbol : null,
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
      indexed_report_price,
      indexed_release_price,

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