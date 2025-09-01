// app/api/cron/cot/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.CRON_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const r = await fetch(`${base}/api/cot?refresh=1`, { cache: "no-store" });
    const text = await r.text();
    return new Response(
      JSON.stringify({ ok: r.ok, status: r.status, body: text.slice(0, 2000) }),
      { headers: { "content-type": "application/json" }, status: r.ok ? 200 : 500 }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "fetch failed" }),
      { headers: { "content-type": "application/json" }, status: 500 }
    );
  }
}
