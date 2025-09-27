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
  actual_value: number | null;          // ppm long or null
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
  const rows: Value[] = raw.filter(isValue);

  if (rows.length === 0) {
    return Response.json({ message: "values upsert ok", summary: { total: 0, created: 0, updated: 0 } });
  }

  // Upsert on `id` (Value IDs are unique in MT5)
  const { data, error } = await supabaseAdmin
    .from("calendar_values")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) {
    return Response.json({ message: "db error", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: "values upsert ok",
    summary: { total: rows.length, created: 0, updated: data?.length ?? 0 },
  });
}
