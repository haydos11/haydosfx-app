import { checkAuth } from "../../_lib/auth";

export const runtime = "nodejs";

// MT5 country payload
type Country = {
  id: number;
  name: string;
  code: string;
  currency: string;
  currency_symbol: string;
  url_name?: string | null;
};

function isCountry(x: unknown): x is Country {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.name === "string" &&
    typeof o.code === "string" &&
    typeof o.currency === "string" &&
    typeof o.currency_symbol === "string" &&
    (o.url_name === undefined ||
      o.url_name === null ||
      typeof o.url_name === "string")
  );
}

type CountriesBody = { countries?: unknown };

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: CountriesBody;
  try {
    body = (await req.json()) as CountriesBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const input = Array.isArray(body.countries) ? body.countries : [];
  const countries: Country[] = input.filter(isCountry);

  // TODO: upsert `countries` into your DB

  return Response.json({
    message: "countries upsert ok",
    summary: { total: countries.length, created: 0, updated: 0 },
  });
}
