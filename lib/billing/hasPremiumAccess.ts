import { getAppSupabaseAdmin } from "@/lib/supabase/appAdmin";

export async function hasPremiumAccess(userId: string) {
  const supabase = getAppSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_customer_access")
    .select("premium_active, subscription_status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed checking premium access: ${error.message}`);
  }

  return Boolean(data?.premium_active);
}