import { checkAuth } from "../../_lib/auth";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const arr = Array.isArray(body?.events) ? body.events : [];
  // NOTE: MT5 sends `digits` as a STRING; keep or coerce as needed.
  // TODO: upsert into DB…

  return Response.json({
    message: "events upsert ok",
    summary: { total: arr.length, created: 0, updated: 0 }
  });
}
