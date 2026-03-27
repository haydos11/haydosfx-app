import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MARKETS, type MarketInfo } from "@/lib/cot/markets";

type SnapshotRow = {
  market_code: string;
  market_name: string;
  report_date: string;
  category: string | null;

  long_pct: number | null;
  prev_long_pct: number | null;
  short_pct: number | null;
  prev_short_pct: number | null;

  net_noncommercial: number | null;
  prev_net_noncommercial: number | null;
  weekly_change_noncommercial: number | null;
  change_pct: number | null;
  net_noncommercial_pct_oi: number | null;

  market_bias: string | null;

  usd_directional: number | null;
  prev_usd_directional: number | null;

  position_bias: string | null;
  report_price: number | null;
  release_price: number | null;
  move_pct_report_to_release: number | null;
  price_direction: string | null;
  reaction_type: string | null;
};

type GroupName = MarketInfo["group"] | "OTHER";

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

const META_BY_DB_CODE = new Map(
  MARKETS.map((m) => [MARKET_KEY_TO_DB_CODE[m.key], m] as const).filter(
    (entry): entry is [string, MarketInfo] => Boolean(entry[0])
  )
);

function fallbackGroup(category: string | null): GroupName {
  const c = (category ?? "").toUpperCase();
  if (c === "FX") return "FX";
  if (c === "ENERGY") return "ENERGY";
  if (c === "INDEX") return "INDEX";
  if (c === "METALS") return "METALS";
  if (c === "AGRI") return "AGRI";
  if (c === "RATES") return "RATES";
  if (c === "CRYPTO") return "CRYPTO";
  return "OTHER";
}

function normalizeBias(
  v: string | null | undefined
): "bullish" | "bearish" | "neutral" | null {
  if (!v) return null;
  if (/bullish/i.test(v)) return "bullish";
  if (/bearish/i.test(v)) return "bearish";
  if (/neutral/i.test(v)) return "neutral";
  return null;
}

function positioningSentiment(
  bias: string | null,
  weeklyChange: number | null
): string | null {
  const normalized = normalizeBias(bias);
  if (!normalized) return null;

  if (weeklyChange == null || weeklyChange === 0) {
    if (normalized === "bullish") return "Flat Bullish";
    if (normalized === "bearish") return "Flat Bearish";
    return "Neutral";
  }

  if (normalized === "bullish") {
    return weeklyChange > 0 ? "Increasing Bullish" : "Less Bullish";
  }

  if (normalized === "bearish") {
    return weeklyChange < 0 ? "Increasing Bearish" : "Less Bearish";
  }

  return "Neutral";
}

function biasFromDirectional(
  usdDirectional: number | null,
  netContracts: number | null
): "bullish" | "bearish" | "neutral" | null {
  const v = usdDirectional ?? netContracts;
  if (v == null) return null;
  if (v > 0) return "bullish";
  if (v < 0) return "bearish";
  return "neutral";
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("cot_snapshot_latest_fast_mv")
      .select(`
        market_code,
        market_name,
        report_date,
        category,
        long_pct,
        prev_long_pct,
        short_pct,
        prev_short_pct,
        net_noncommercial,
        prev_net_noncommercial,
        weekly_change_noncommercial,
        change_pct,
        net_noncommercial_pct_oi,
        market_bias,
        usd_directional,
        prev_usd_directional,
        position_bias,
        report_price,
        release_price,
        move_pct_report_to_release,
        price_direction,
        reaction_type
      `)
      .order("market_code", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as SnapshotRow[]).map((r) => {
      const market = META_BY_DB_CODE.get(r.market_code);
      const group = market?.group ?? fallbackGroup(r.category);
      const isFx = group === "FX";

      const directionalBias = biasFromDirectional(
        toNum(r.usd_directional),
        toNum(r.net_noncommercial)
      );

      const finalBias = normalizeBias(
        isFx ? (r.position_bias ?? directionalBias) : directionalBias
      );

      const marketBias = normalizeBias(r.market_bias) ?? finalBias;

      return {
        market_code: r.market_code,
        key: market?.key ?? r.market_code.toLowerCase(),
        code: market?.code ?? r.market_code,
        name: market?.name ?? r.market_name,
        group,
        category: r.category,
        date: r.report_date,

        longPct: toNum(r.long_pct),
        prevLongPct: toNum(r.prev_long_pct),
        shortPct: toNum(r.short_pct),
        prevShortPct: toNum(r.prev_short_pct),

        marketBias,
        sentiment: positioningSentiment(finalBias, toNum(r.weekly_change_noncommercial)),

        netContracts: toNum(r.net_noncommercial),
        prevNet: toNum(r.prev_net_noncommercial),
        changePct: toNum(r.change_pct),
        weeklyChange: toNum(r.weekly_change_noncommercial),
        netPctOi: toNum(r.net_noncommercial_pct_oi),

        usdDirectional: toNum(r.usd_directional),
        prevUsdDirectional: toNum(r.prev_usd_directional),

        bias: finalBias,
        reportPrice: toNum(r.report_price),
        releasePrice: toNum(r.release_price),
        movePct: toNum(r.move_pct_report_to_release),
        priceDirection: r.price_direction,
        reaction: r.reaction_type,
      };
    });

    const latestDate =
      rows
        .map((r) => r.date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return NextResponse.json({
      updated: new Date().toISOString(),
      date: latestDate,
      count: rows.length,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(message, { status: 500 });
  }
}