import { createClient } from "@supabase/supabase-js";
import { LiveRate } from "../cbanks";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sb =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

export async function upsertSnapshotRows(rows: LiveRate[]) {
  if (!sb) return;
  if (!rows.length) return;
  try {
    const mapped = rows.map((r) => ({
      cb_code: r.cb_code,
      country: r.country,
      currency: r.currency,
      current: r.current,
      previous: r.previous,
      forecast: r.forecast,
      source_live: r.source,
      released_at: r.released_at,
      next_meeting: r.next_meeting,
      updated_at: new Date().toISOString(),
    }));
    await sb.from("interest_rates").upsert(mapped, { onConflict: "cb_code" });
  } catch (e) {
    console.warn("[supabase] upsertSnapshotRows failed:", e);
  }
}

export async function insertHistoryRows(
  rows: Array<{
    cb_code: string;
    rate: number;
    effective_date: string;
    source: string;
    country?: string;
    currency?: string;
  }>
) {
  if (!sb || !rows.length) return;
  try {
    const mapped = rows.map((r) => ({
      cb_code: r.cb_code,
      country: r.country ?? null,
      currency: r.currency ?? null,
      rate: r.rate,
      effective_date: r.effective_date,
      source: r.source,
    }));

    // ✅ Fix: use string literal instead of "as any"
    await sb
      .from("interest_rates_history")
      .upsert(mapped, { onConflict: "cb_code,effective_date" as string });
  } catch (e) {
    console.warn("[supabase] insertHistoryRows failed:", e);
  }
}
