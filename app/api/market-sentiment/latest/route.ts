import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: snapshot, error: snapshotError } = await supabase
      .from("market_sentiment_intraday_snapshots")
      .select("*")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) throw snapshotError;

    const { data: prices, error: pricesError } = await supabase
      .from("market_sentiment_intraday_prices")
      .select("*")
      .eq("ts", snapshot?.ts ?? "")
      .order("asset_code", { ascending: true });

    if (pricesError) throw pricesError;

    return NextResponse.json({
      ok: true,
      snapshot,
      prices: prices ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}