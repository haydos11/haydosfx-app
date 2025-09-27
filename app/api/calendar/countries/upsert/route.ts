import { checkAuth } from "../../_lib/auth";

export const runtime = "nodejs"; // ensure Node (not Edge) for larger bodies

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (!auth.ok) return new Response(auth.msg, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const arr = Array.isArray(body?.countries) ? body.countries : [];
  // TODO: upsert into your DB here…

  return Response.json({
    message: "countries upsert ok",
    summary: { total: arr.length, created: 0, updated: 0 } // fill if you track it
  });
}
