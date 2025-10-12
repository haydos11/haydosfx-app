// app/api/rates/live/archive/route.ts
import { NextResponse } from "next/server";
import { DEFAULT_CODES } from "@/lib/rates/cbanks";
import { fetchVerifiedOfficial } from "@/lib/rates/verify";
import { insertHistoryRows } from "@/lib/rates/store/supabase";

export const runtime = "nodejs";

export async function POST() {
  try {
    const verified = await fetchVerifiedOfficial(DEFAULT_CODES);
    const rows = verified
      .filter(v => v.rate != null && v.effective_date)
      .map(v => ({
        cb_code: v.cb_code,
        rate: v.rate as number,
        effective_date: v.effective_date as string,
        source: v.source,
      }));

    if (rows.length) await insertHistoryRows(rows);

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
