// app/api/cftc-raw/route.ts
export async function GET() {
  const base = process.env.CFTC_URL!;
  const headers: Record<string, string> = {};
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;

  try {
    const r = await fetch(`${base}?$limit=5`, { cache: "no-store", headers });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") ?? "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
