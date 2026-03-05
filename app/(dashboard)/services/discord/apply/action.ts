"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

function reqString(formData: FormData, key: string, label: string) {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) throw new Error(`${label} is required.`);
  return v;
}

function optString(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? "").trim();
  return v ? v : null;
}

export async function submitDiscordAccessRequest(formData: FormData) {
  // Honeypot anti-bot field (hidden input in the form)
  const company = String(formData.get("company") ?? "").trim();
  if (company) {
    redirect("/services/discord/apply/success");
  }

  const name = reqString(formData, "name", "Name");
  const email = reqString(formData, "email", "Email");
  const discord_username = reqString(formData, "discord_username", "Discord username");
  const message = optString(formData, "message");

  if (!email.includes("@")) throw new Error("Please enter a valid email.");

  const supabase = supabaseServer();

  // Basic duplicate protection: same email within last 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recent, error: recentErr } = await supabase
    .from("discord_access_requests")
    .select("id")
    .eq("email", email)
    .gte("created_at", since)
    .limit(1);

  if (!recentErr && recent && recent.length > 0) {
    throw new Error("You’ve already requested access recently. Please wait a few minutes.");
  }

  const { error } = await supabase.from("discord_access_requests").insert({
    name,
    email,
    discord_username,
    message,
    status: "pending",
  });

  if (error) {
    console.error("Supabase insert error:", error);
    throw new Error("Could not submit your request. Please try again.");
  }

  // DB webhook → Edge Function → Discord notification will fire automatically
  redirect("/services/discord/apply/success");
}