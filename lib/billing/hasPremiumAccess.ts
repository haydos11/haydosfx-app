import { getAppSupabaseAdmin } from "@/lib/supabase/appAdmin";

function normaliseEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function isManualGrantCurrentlyValid(row: {
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
}) {
  if (!row.is_active) return false;

  const now = Date.now();

  if (row.starts_at) {
    const startsAt = new Date(row.starts_at).getTime();
    if (!Number.isNaN(startsAt) && now < startsAt) {
      return false;
    }
  }

  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at).getTime();
    if (!Number.isNaN(expiresAt) && now > expiresAt) {
      return false;
    }
  }

  return true;
}

export async function hasPremiumAccess(userId: string, email?: string | null) {
  const supabase = getAppSupabaseAdmin();

  const [{ data: stripeRow, error: stripeError }, { data: manualRows, error: manualError }] =
    await Promise.all([
      supabase
        .from("billing_customer_access")
        .select("premium_active, subscription_status, current_period_end, on_hold, email")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("billing_manual_access")
        .select("is_active, starts_at, expires_at, email, feature_key")
        .eq("feature_key", "premium")
        .eq("is_active", true),
    ]);

  if (stripeError) {
    throw new Error(`Failed checking Stripe premium access: ${stripeError.message}`);
  }

  if (manualError) {
    throw new Error(`Failed checking manual premium access: ${manualError.message}`);
  }

  const stripeAccess = Boolean(stripeRow?.premium_active && !stripeRow?.on_hold);

  const candidateEmails = new Set<string>();
  const explicitEmail = normaliseEmail(email);
  const stripeEmail = normaliseEmail(stripeRow?.email);

  if (explicitEmail) candidateEmails.add(explicitEmail);
  if (stripeEmail) candidateEmails.add(stripeEmail);

  const manualAccess = (manualRows ?? []).some((row) => {
    const rowEmail = normaliseEmail(row.email);
    if (!rowEmail) return false;
    if (!candidateEmails.has(rowEmail)) return false;
    return isManualGrantCurrentlyValid(row);
  });

  return stripeAccess || manualAccess;
}