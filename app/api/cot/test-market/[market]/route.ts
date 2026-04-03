import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveMarket } from "@/lib/cot/markets";
import { requireApiPremium } from "@/lib/auth/require-api-premium";

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

function isoDate(v: string): string {
  return String(v).slice(0, 10);
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

    const isFx = FX_DB_CODES.has(dbCode);
    const range = (req.nextUrl.searchParams.get("range") ?? "5y").toLowerCase();
    const startDate = cutoffFor(range);

    const recentCountRaw = Number(req.nextUrl.searchParams.get("recent") ?? "12");
    const recentCount = Number.isFinite(recentCountRaw)
      ? Math.max(12, Math.min(52, Math.floor(recentCountRaw)))
      : 12;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("cot_market_history_serving")
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

    const price_symbol = isFx ? rows[0]?.base_ccy ?? null : dbCode;

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

      large_usd.push(toNum(row.usd_signed_exposure));
      small_usd.push(null);
      comm_usd.push(null);

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
      .map((row) => ({
        date: isoDate(row.report_date),
        release_date: row.release_date ? isoDate(row.release_date) : null,
        next_report_date: row.next_report_date ? isoDate(row.next_report_date) : null,

        open_interest: toNum(row.oi_total),

        large_spec_net: toNum(row.net_noncommercial) ?? 0,
        large_spec_long: toNum(row.long_noncommercial),
        large_spec_short: toNum(row.short_noncommercial),

        small_traders_net: toNum(row.net_nonreportable) ?? 0,
        commercials_net: toNum(row.net_commercial) ?? 0,

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

        large_spec_net_usd: toNum(row.usd_signed_exposure),
        small_traders_net_usd: null,
        commercials_net_usd: null,

        d_large: toNum(row.d_net_noncommercial),
        d_large_long: toNum(row.d_long_noncommercial),
        d_large_short: toNum(row.d_short_noncommercial),
        d_small: toNum(row.d_net_nonreportable),
        d_comm: toNum(row.d_net_commercial),
        d_oi: toNum(row.d_oi_total),
      }));

    return NextResponse.json({
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