export async function GET() {
  const url = process.env.KV_REST_API_URL!;
  const token = process.env.KV_REST_API_TOKEN!;
  try {
    const setRes = await fetch(`${url}/set/kv:test/pong`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const getRes = await fetch(`${url}/get/kv:test`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await getRes.text();
    return new Response(
      JSON.stringify({
        ok: setRes.ok && getRes.ok,
        setStatus: setRes.status,
        getStatus: getRes.status,
        body,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
