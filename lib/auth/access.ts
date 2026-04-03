import { getSupabaseServerClient } from "./server";

export type AccessResult = {
  user: { id: string; email?: string | null } | null;
  role: "user" | "admin" | null;
  subscriptionStatus: string | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isPremium: boolean;
};

export async function getAccessState(): Promise<AccessResult> {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      role: null,
      subscriptionStatus: null,
      isLoggedIn: false,
      isAdmin: false,
      isPremium: false,
    };
  }

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const role = (profile?.role ?? "user") as "user" | "admin";
  const subscriptionStatus = subscription?.status ?? "inactive";

  const isAdmin = role === "admin";
  const isPremium =
    isAdmin ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing";

  return {
    user: { id: user.id, email: user.email },
    role,
    subscriptionStatus,
    isLoggedIn: true,
    isAdmin,
    isPremium,
  };
}