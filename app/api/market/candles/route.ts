import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TIMEFRAMES = new Set([
  "M1",
  "M5",
  "M15",
  "M30",
  "H1",
  "H4",
  "D1",
  "W1",
  "MN1",
]);

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.DATA_SUPABASE_URL;
    const serviceRoleKey = process.env.DATA_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing DATA_SUPABASE_URL or DATA_SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);

    const symbol = String(searchParams.get("symbol") ?? "").trim().toUpperCase();
    const timeframe = String(searchParams.get("timeframe") ?? "").trim().toUpperCase();
    const limitRaw = Number(searchParams.get("limit") ?? "500");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!symbol) return badRequest("Missing symbol");
    if (!timeframe) return badRequest("Missing timeframe");
    if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
      return badRequest(`Invalid timeframe: ${timeframe}`);
    }

    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(5000, Math.trunc(limitRaw)))
      : 500;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let query = supabase
      .from("fx_candles")
      .select(
        "symbol,timeframe,time,open,high,low,close,tick_volume,spread,real_volume,source"
      )
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .order("time", { ascending: false })
      .limit(limit);

    if (from) query = query.gte("time", from);
    if (to) query = query.lte("time", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const candles = [...(data ?? [])].reverse();

    return NextResponse.json({
      ok: true,
      symbol,
      timeframe,
      count: candles.length,
      candles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}