import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MARKETS, type MarketInfo } from "@/lib/cot/markets";
import { requireApiPremium } from "@/lib/auth/require-api-premium";

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

  usd_signed_exposure: number | null;
  prev_usd_signed_exposure: number | null;

  position_bias: string | null;
  position_trend: string | null;

  report_price: number | null;
  release_price: number | null;
  reaction_move_pct: number | null;
  reaction_direction: string | null;
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

  gold: "GC",
  silver: "SI",
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
  trend: string | null,
  bias: string | null,
  weeklyChange: number | null
): string | null {
  if (trend) {
    if (/increasing bullish/i.test(trend)) return "Increasing Bullish";
    if (/less bullish/i.test(trend)) return "Less Bullish";
    if (/increasing bearish/i.test(trend)) return "Increasing Bearish";
    if (/less bearish/i.test(trend)) return "Less Bearish";
    if (/flat/i.test(trend) && /bullish/i.test(bias ?? "")) return "Flat Bullish";
    if (/flat/i.test(trend) && /bearish/i.test(bias ?? "")) return "Flat Bearish";
  }

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

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const gate = await requireApiPremium();
    if (!gate.ok) return gate.response;
    
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("cot_snapshot_serving")
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
        usd_signed_exposure,
        prev_usd_signed_exposure,
        position_bias,
        position_trend,
        report_price,
        release_price,
        reaction_move_pct,
        reaction_direction,
        reaction_type
      `)
      .order("market_code", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as SnapshotRow[]).map((r) => {
      const market = META_BY_DB_CODE.get(r.market_code);
      const group = market?.group ?? fallbackGroup(r.category);
      const finalBias = normalizeBias(r.position_bias);

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

        marketBias: finalBias,
        sentiment: positioningSentiment(
          r.position_trend,
          finalBias,
          toNum(r.weekly_change_noncommercial)
        ),

        netContracts: toNum(r.net_noncommercial),
        prevNet: toNum(r.prev_net_noncommercial),
        changePct: toNum(r.change_pct),
        weeklyChange: toNum(r.weekly_change_noncommercial),
        netPctOi: toNum(r.net_noncommercial_pct_oi),

        usdDirectional: toNum(r.usd_signed_exposure),
        prevUsdDirectional: toNum(r.prev_usd_signed_exposure),

        bias: finalBias,
        reportPrice: toNum(r.report_price),
        releasePrice: toNum(r.release_price),
        movePct: toNum(r.reaction_move_pct),
        priceDirection: r.reaction_direction,
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