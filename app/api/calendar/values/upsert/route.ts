import { checkAuth } from "../../_lib/auth";
export const runtime = "nodejs";

// MT5 values payload
type Value = {
  id: number;
  event_id: number;
  time: number;    // epoch seconds
  period: number;  // epoch seconds
  revision: number;
  impact_type: number;
  actual_value: number | null;
  prev_value: number | null;
  revised_prev_value: number | null;
  forecast_value: number | null;
};

function isNullOrNumber(v: unknown): v is number | null {
  return v === null || typeof v === "number";
}

function isValue(x: unknown): x is Value {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.event_id === "number" &&
    typeof o.time === "number" &&
    typeof o.period === "number" &&
    typeof o.revision === "number" &&
    typeof o.impact_type === "number" &&
    isNullOrNumber(o.actual_value) &&
    isNullOrNumber(o.prev_value) &&
    isNullOrNumber(o.revised_prev_value) &&
    isNullOrNumber(o.forecast_value)
  );
}

type ValuesBody = { values?: unknown };

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: ValuesBody;
  try {
    body = (await req.json()) as ValuesBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const input = Array.isArray(body.values) ? body.values : [];
  const values: Value[] = input.filter(isValue);

  // TODO: upsert `values` into your DB

  return Response.json({
    message: "values upsert ok",
    summary: { total: values.length, created: 0, updated: 0 },
  });
}