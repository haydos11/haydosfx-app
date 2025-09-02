import { kv } from "@vercel/kv";
import { errorMessage } from "@/app/lib/errorMessage";

export async function GET() {
  try {
    await kv.set("kv:ping", "pong", { ex: 60 });
    const v = (await kv.get<string>("kv:ping")) ?? null;
    return new Response(JSON.stringify({ ok: true, value: v }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: errorMessage(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
