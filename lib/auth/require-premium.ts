import { redirect } from "next/navigation";
import { getAccessState } from "./access";

export async function requirePremium(nextPath?: string) {
  const access = await getAccessState();

  if (!access.isLoggedIn) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${next}`);
  }

  if (!access.isPremium) {
    redirect("/upgrade");
  }

  return access;
}