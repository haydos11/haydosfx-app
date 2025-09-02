import { errorMessage } from "@/app/lib/errorMessage";

export async function GET() {
  const url = process.env.KV_REST_API_URL!;
  const token = process.env.KV_REST_API_TOKEN!;
  const auth = { Authorization: `Bearer ${token}` };

  try {
    const setRes = await fetch(`${url}/set/kv:ping/pong`, { headers: auth });
    const getRes = await fetch(`${url}/get/kv:ping`, { headers: auth });
    const getJson = await getRes.json();

    return new Response(
      JSON.stringify({
        ok: setRes.ok && getRes.ok,
        setStatus: setRes.status,
        getStatus: getRes.status,
        body: getJson,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: errorMessage(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
