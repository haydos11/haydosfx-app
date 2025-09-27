import { checkAuth } from "../../_lib/auth";
export const runtime = "nodejs";

// MT5 event payload (digits might arrive as string; normalize to number | undefined)
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
  digits?: number;
  source_url?: string;
  event_code: string;
  name: string;
};

// Raw input where digits may be number | string | undefined
type EventIn = Omit<Event, "digits"> & { digits?: number | string };

function isEventIn(x: unknown): x is EventIn {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const reqNumbers =
    typeof o.id === "number" &&
    typeof o.type === "number" &&
    typeof o.sector === "number" &&
    typeof o.frequency === "number" &&
    typeof o.time_mode === "number" &&
    typeof o.country_id === "number" &&
    typeof o.unit === "number" &&
    typeof o.importance === "number" &&
    typeof o.multiplier === "number";

  const reqStrings =
    typeof o.event_code === "string" && typeof o.name === "string";

  const okDigits =
    o.digits === undefined ||
    typeof o.digits === "number" ||
    typeof o.digits === "string";

  const okSource = o.source_url === undefined || typeof o.source_url === "string";

  return reqNumbers && reqStrings && okDigits && okSource;
}

function normalizeEvent(e: EventIn): Event {
  let digits: number | undefined = undefined;
  if (typeof e.digits === "number") digits = e.digits;
  else if (typeof e.digits === "string") {
    const n = Number(e.digits);
    if (!Number.isNaN(n)) digits = n;
  }

  return {
    id: e.id,
    type: e.type,
    sector: e.sector,
    frequency: e.frequency,
    time_mode: e.time_mode,
    country_id: e.country_id,
    unit: e.unit,
    importance: e.importance,
    multiplier: e.multiplier,
    digits,
    source_url: e.source_url,
    event_code: e.event_code,
    name: e.name,
  };
}

type EventsBody = { events?: unknown };

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: EventsBody;
  try {
    body = (await req.json()) as EventsBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const input = Array.isArray(body.events) ? body.events : [];
  const events: Event[] = input.filter(isEventIn).map(normalizeEvent);

  // TODO: upsert `events` into your DB

  return Response.json({
    message: "events upsert ok",
    summary: { total: events.length, created: 0, updated: 0 },
  });
}
