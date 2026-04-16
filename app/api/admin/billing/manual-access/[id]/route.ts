import { getAppSupabaseAdmin } from "@/lib/supabase/appAdmin";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const body = (await req.json()) as {
      is_active?: boolean;
      expires_at?: string | null;
      reason?: string | null;
    };

    const updates: Record<string, unknown> = {};

    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (body.expires_at !== undefined) {
      updates.expires_at =
        typeof body.expires_at === "string" && body.expires_at.trim()
          ? new Date(body.expires_at).toISOString()
          : null;
    }

    if (body.reason !== undefined) {
      updates.reason =
        typeof body.reason === "string" ? body.reason.trim() || null : null;
    }

    const supabase = getAppSupabaseAdmin();

    const { error } = await supabase
      .from("billing_manual_access")
      .update(updates)
      .eq("id", id);

    if (error) {
      throw new Error(`Failed updating manual access: ${error.message}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed updating manual access";

    return new Response(message, { status: 500 });
  }
}