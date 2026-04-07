import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseAppServerClient } from "@/lib/supabase/app-server";
import { supabaseServer } from "@/lib/supabase/server";

function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdminUser() {
  const supabase = await getSupabaseAppServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email?.toLowerCase() ?? "";
  const adminEmails = parseAdminEmails();

  if (email && adminEmails.includes(email)) {
    return user;
  }

  try {
    const adminDb = supabaseServer();
    const { data: profile } = await adminDb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return user;
    }
  } catch {
    // fall through
  }

  redirect("/");
}