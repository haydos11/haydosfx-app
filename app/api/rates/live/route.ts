import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CODES } from "@/lib/rates/cbanks";
import {
  fetchMyfxbookWindow,
  extractMyfxbookRates,
  fetchForexFactoryThisWeek,
  extractForexFactoryRates,
  mergeLive,
} from "@/lib/rates/live";
import { upsertSnapshotRows } from "@/lib/rates/store/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const codes = (params.get("codes") || "")
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    const list = codes.length ? codes : DEFAULT_CODES;

    // 7-day window around today to catch week-of decisions
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 86400_000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 4 * 86400_000).toISOString().slice(0, 10);

    const [myfxRaw, ffJson] = await Promise.all([
      fetchMyfxbookWindow(from, to),
      fetchForexFactoryThisWeek(),
    ]);

    const myfx = extractMyfxbookRates(myfxRaw, list);
    const ffx = extractForexFactoryRates(ffJson, list);
    const merged = mergeLive(myfx, ffx);

    await upsertSnapshotRows(merged);

    return NextResponse.json({ ok: true, rows: merged });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
