import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotComponent = {
  score: number;
  latestChange: number | null;
  hourChange: number | null;
  rolling2hChange?: number | null;
  rolling4hChange?: number | null;
  previousDaySameTimeChange?: number | null;
  londonChange: number | null;
  sessionChange: number | null;
  direction: "risk_on" | "risk_off" | "neutral";
};

type SnapshotRow = {
  ts: string;
  regime: string;
  score: number;
  breadth: number;
  improving: boolean;
  degrading: boolean;
  confidence: number;
  previous_score_change: number | null;
  london_change_score: number | null;
  session_change_score: number | null;
  previous_day_same_time_score_change?: number | null;
  rolling_2h_score_change?: number | null;
  rolling_4h_score_change?: number | null;
  summary_text: string;
  components: Record<string, SnapshotComponent>;
};

type PriceRow = {
  ts: string;
  asset_code: string;
  asset_name: string;
  asset_class: string;
  price: number;
  prev_15m_change_pct: number | null;
  hour_change_pct: number | null;
  rolling_2h_change_pct?: number | null;
  rolling_4h_change_pct?: number | null;
  previous_day_same_time_change_pct?: number | null;
  london_change_pct: number | null;
  session_change_pct: number | null;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: snapshot, error: snapshotError } = await supabase
      .from("market_sentiment_intraday_snapshots")
      .select("*")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle<SnapshotRow>();

    if (snapshotError) throw snapshotError;
    if (!snapshot) {
      return NextResponse.json({
        ok: true,
        snapshot: null,
        prices: [],
        history: [],
      });
    }

    const { data: history, error: historyError } = await supabase
      .from("market_sentiment_intraday_snapshots")
      .select("ts,score,regime,breadth")
      .order("ts", { ascending: false })
      .limit(24);

    if (historyError) throw historyError;

    // Pull a recent window and keep the latest row per asset.
    const windowStart = new Date(
      Date.parse(snapshot.ts) - 6 * 60 * 60 * 1000
    ).toISOString();

    const { data: recentPrices, error: pricesError } = await supabase
      .from("market_sentiment_intraday_prices")
      .select("*")
      .gte("ts", windowStart)
      .lte("ts", snapshot.ts)
      .order("ts", { ascending: false })
      .limit(500);

    if (pricesError) throw pricesError;

    const latestByAsset = new Map<string, PriceRow>();

    for (const row of (recentPrices ?? []) as PriceRow[]) {
      if (!latestByAsset.has(row.asset_code)) {
        latestByAsset.set(row.asset_code, row);
      }
    }

    const prices = Array.from(latestByAsset.values()).sort((a, b) =>
      a.asset_code.localeCompare(b.asset_code)
    );

    return NextResponse.json({
      ok: true,
      snapshot,
      prices,
      history: (history ?? []).reverse(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}