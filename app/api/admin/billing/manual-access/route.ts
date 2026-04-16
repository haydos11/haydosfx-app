import { getAppSupabaseAdmin } from "@/lib/supabase/appAdmin";

export const runtime = "nodejs";

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseDateOrNull(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return date.toISOString();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      feature_key?: string;
      reason?: string | null;
      starts_at?: string | null;
      expires_at?: string | null;
      granted_by?: string | null;
    };

    const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
    const featureKey =
      typeof body.feature_key === "string" && body.feature_key.trim()
        ? body.feature_key.trim()
        : "premium";

    if (!email) {
      return new Response("Email is required", { status: 400 });
    }

    const supabase = getAppSupabaseAdmin();

    const { error } = await supabase.from("billing_manual_access").insert({
      email,
      feature_key: featureKey,
      is_active: true,
      reason: typeof body.reason === "string" ? body.reason.trim() || null : null,
      starts_at: parseDateOrNull(body.starts_at),
      expires_at: parseDateOrNull(body.expires_at),
      granted_by:
        typeof body.granted_by === "string" ? body.granted_by.trim() || null : "admin",
    });

    if (error) {
      throw new Error(`Failed creating manual access: ${error.message}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed creating manual access";

    return new Response(message, { status: 500 });
  }
}