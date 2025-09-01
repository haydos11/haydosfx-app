import { kv } from "@vercel/kv";

export async function GET() {
  try {
    // Write a test value
    await kv.set("kv:ping", "pong", { ex: 60 });

    // Read it back
    const v = await kv.get("kv:ping");

    return new Response(JSON.stringify({ ok: true, value: v }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
