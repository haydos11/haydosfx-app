import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tick_volume?: number;
  spread?: number;
  real_volume?: number;
};

type IncomingPayload = {
  symbol: string;
  timeframe: string;
  bars: IncomingBar[];
};

function getAuthSecret(req: NextRequest): string {
  const headerSecret = req.headers.get("x-candle-secret");
  if (headerSecret) return headerSecret;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }

  return "";
}

function isValidTimeframe(tf: string): boolean {
  return ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"].includes(tf);
}

function toIsoFromUnixSeconds(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.MT5_CANDLE_SECRET;
    const providedSecret = getAuthSecret(req);

    if (!expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Server missing MT5_CANDLE_SECRET" },
        { status: 500 }
      );
    }

    if (providedSecret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as IncomingPayload;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    const timeframe = String(body.timeframe ?? "").trim().toUpperCase();
    const bars = Array.isArray(body.bars) ? body.bars : [];

    if (!symbol) {
      return NextResponse.json(
        { ok: false, error: "Missing symbol" },
        { status: 400 }
      );
    }

    if (!isValidTimeframe(timeframe)) {
      return NextResponse.json(
        { ok: false, error: `Invalid timeframe: ${timeframe}` },
        { status: 400 }
      );
    }

    if (bars.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No bars provided" },
        { status: 400 }
      );
    }

    const rows = bars.map((bar) => {
      if (
        typeof bar.time !== "number" ||
        typeof bar.open !== "number" ||
        typeof bar.high !== "number" ||
        typeof bar.low !== "number" ||
        typeof bar.close !== "number"
      ) {
        throw new Error("Invalid bar structure");
      }

      return {
        symbol,
        timeframe,
        time: toIsoFromUnixSeconds(bar.time),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        tick_volume:
          typeof bar.tick_volume === "number" ? Math.trunc(bar.tick_volume) : null,
        spread:
          typeof bar.spread === "number" ? Math.trunc(bar.spread) : null,
        real_volume:
          typeof bar.real_volume === "number" ? Math.trunc(bar.real_volume) : null,
        source: "mt5",
      };
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase
      .from("fx_candles")
      .upsert(rows, {
        onConflict: "symbol,timeframe,time",
        ignoreDuplicates: false,
      });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      symbol,
      timeframe,
      received: bars.length,
      upserted: rows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}