import { NextResponse } from "next/server";
import { getAccessState } from "@/lib/auth/access";

export async function requireApiPremium() {
  const access = await getAccessState();

  if (!access.isLoggedIn) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!access.isPremium) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Premium required" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    access,
  };
}