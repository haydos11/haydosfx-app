import { checkAuth } from "../../_lib/auth";
import { supabaseAdmin } from "../../../../../lib/db/supabase-admin";

export const runtime = "nodejs";

type Value = {
  id: number;
  event_id: number;
  time: number;                 // epoch seconds
  period: number;               // epoch seconds
  revision: number;
  impact_type: number;
  actual_value: number | null;
  prev_value: number | null;
  revised_prev_value: number | null;
  forecast_value: number | null;
};

type ValuesBody = { values?: unknown };

function isFiniteOrNull(x: unknown): x is number | null {
  return x === null || (typeof x === "number" && Number.isFinite(x));
}
function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isValue(x: unknown): x is Value {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    isFiniteNum(o.id) &&
    isFiniteNum(o.event_id) &&
    isFiniteNum(o.time) &&
    isFiniteNum(o.period) &&
    isFiniteNum(o.revision) &&
    isFiniteNum(o.impact_type) &&
    isFiniteOrNull(o.actual_value) &&
    isFiniteOrNull(o.prev_value) &&
    isFiniteOrNull(o.revised_prev_value) &&
    isFiniteOrNull(o.forecast_value)
  );
}

// choose the "best" row when duplicates share (event_id,time)
function pickBetter(a: Value, b: Value): Value {
  // 1) prefer higher revision
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b;

  // 2) prefer row with more non-null fields
  const richness = (r: Value) =>
    (r.actual_value !== null ? 1 : 0) +
    (r.prev_value !== null ? 1 : 0) +
    (r.revised_prev_value !== null ? 1 : 0) +
    (r.forecast_value !== null ? 1 : 0);
  const ra = richness(a), rb = richness(b);
  if (ra !== rb) return ra > rb ? a : b;

  // 3) stable tie-breaker: larger id wins (MT5 ids tend to increase over time)
  return a.id >= b.id ? a : b;
}

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: ValuesBody;
  try {
    body = (await req.json()) as ValuesBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const raw = Array.isArray(body.values) ? body.values : [];
  const rows = raw.filter(isValue) as Value[];

  if (rows.length === 0) {
    return Response.json({ message: "values upsert ok", summary: { total: 0, deduped: 0, created: 0, updated: 0 } });
  }

  // ✅ De-duplicate by (event_id,time) inside this batch
  const map = new Map<string, Value>();
  for (const r of rows) {
    const key = `${r.event_id}-${r.time}`;
    const prev = map.get(key);
    map.set(key, prev ? pickBetter(prev, r) : r);
  }
  const deduped = Array.from(map.values());

  // (Optional) small batching to be gentle under load
  const CHUNK = 1000;
  let updatedCount = 0;
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    const { data, error } = await supabaseAdmin
      .from("calendar_values")
      .upsert(chunk, { onConflict: "event_id,time" }) // <- composite key
      .select("id");

    if (error) {
      return Response.json(
        { message: "db error", details: error.message, batchFrom: i, batchTo: Math.min(i + CHUNK, deduped.length) },
        { status: 500 }
      );
    }
    updatedCount += data?.length ?? 0;
  }

  return Response.json({
    message: "values upsert ok",
    summary: { total: rows.length, deduped: deduped.length, created: 0, updated: updatedCount },
  });
}
