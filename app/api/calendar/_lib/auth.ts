export function checkAuth(req: Request) {
  const secret = process.env.CALENDAR_SECRET?.trim();
  if (!secret) return { ok: false, msg: "Server missing CALENDAR_SECRET" };

  const x = req.headers.get("x-calendar-secret")?.trim();
  if (x && x === secret) return { ok: true };

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token && token === secret) return { ok: true };

  return { ok: false, msg: "Unauthorized" };
}
