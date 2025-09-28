import { checkAuth } from "../../_lib/auth";
import { supabaseAdmin } from "../../../../../lib/db/supabase-admin";

export const runtime = "nodejs";

type Event = {
  id: number;
  type: number;
  sector: number;
  frequency: number;
  time_mode: number;
  country_id: number;
  unit: number;
  importance: number;
  multiplier: number;
  digits?: number;          // MT5 may send a string; we coerce
  source_url?: string;
  event_code: string;
  name: string;
};

type EventsBody = { events?: unknown };

function isString(x: unknown): x is string {
  return typeof x === "string";
}
function isFiniteNumish(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function parseDigits(x: unknown): number | undefined {
  if (x === undefined || x === null) return undefined;
  if (isFiniteNumish(x)) return x;
  if (isString(x)) {
    const n = Number(x.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function isEvent(x: unknown): x is Event {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;

  const numericOk =
    isFiniteNumish(o.id) &&
    isFiniteNumish(o.type) &&
    isFiniteNumish(o.sector) &&
    isFiniteNumish(o.frequency) &&
    isFiniteNumish(o.time_mode) &&
    isFiniteNumish(o.country_id) &&
    isFiniteNumish(o.unit) &&
    isFiniteNumish(o.importance) &&
    isFiniteNumish(o.multiplier);

  if (!numericOk) return false;

  if (!isString(o.event_code) || !isString(o.name)) return false;

  if (o.source_url !== undefined && o.source_url !== null && !isString(o.source_url)) return false;

  if (o.digits !== undefined && o.digits !== null) {
    if (!(isFiniteNumish(o.digits) || isString(o.digits))) return false;
  }

  return true;
}

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: EventsBody;
  try {
    body = (await req.json()) as EventsBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const raw = Array.isArray(body.events) ? body.events : [];
  const filtered: Event[] = raw.filter(isEvent);

  // Coerce digits -> number | undefined (no `any` here)
  const rows: Event[] = filtered.map((e) => ({
    ...e,
    digits: parseDigits(e.digits),
  }));

  if (rows.length === 0) {
    return Response.json({
      message: "events upsert ok",
      summary: { total: 0, created: 0, updated: 0 },
    });
  }

  // Ensure table name matches your schema: `events`
  const { data, error } = await supabaseAdmin
    .from("calendar_events")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) {
    return Response.json({ message: "db error", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: "events upsert ok",
    summary: { total: rows.length, created: 0, updated: data?.length ?? 0 },
  });
}
