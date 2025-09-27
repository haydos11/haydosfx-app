import { checkAuth } from "../../_lib/auth";
import { supabaseAdmin } from "../../../../../lib/db/supabase-admin";

export const runtime = "nodejs";

type Country = {
  id: number;
  name: string;
  code: string;
  currency: string;
  currency_symbol: string;
  url_name?: string | null;
};

type CountriesBody = { countries?: unknown };

function isString(x: unknown): x is string { return typeof x === "string"; }
function isNumber(x: unknown): x is number { return typeof x === "number" && Number.isFinite(x); }

function isCountry(x: unknown): x is Country {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    isNumber(o.id) &&
    isString(o.name) &&
    isString(o.code) &&
    isString(o.currency) &&
    isString(o.currency_symbol) &&
    (o.url_name === undefined || o.url_name === null || isString(o.url_name))
  );
}

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: CountriesBody;
  try {
    body = (await req.json()) as CountriesBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const raw = Array.isArray(body.countries) ? body.countries : [];
  const rows: Country[] = raw.filter(isCountry);

  if (rows.length === 0) {
    return Response.json({ message: "countries upsert ok", summary: { total: 0, created: 0, updated: 0 } });
  }

  // Upsert by primary key `id`
  const { data, error } = await supabaseAdmin
    .from("calendar_countries")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) {
    return Response.json({ message: "db error", details: error.message }, { status: 500 });
  }

  return Response.json({
    message: "countries upsert ok",
    summary: { total: rows.length, created: 0, updated: data?.length ?? 0 },
  });
}
