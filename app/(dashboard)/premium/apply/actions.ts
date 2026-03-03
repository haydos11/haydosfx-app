"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
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

function safeText(v: unknown) {
  return (v ?? "").toString().trim();
}

export async function submitApplication(formData: FormData) {
  // Required
  const name = reqString(formData, "name", "Name");
  const email = reqString(formData, "email", "Email");
  const experience = reqString(formData, "experience", "Trading experience");
  const other_groups = reqString(formData, "other_groups", "Other groups");

  // Optional
  const trading_style = optString(formData, "trading_style");
  const discord_alias = optString(formData, "discord_alias");
  const tradingview_name = optString(formData, "tradingview_name");
  const additional_info = optString(formData, "additional_info");

  if (!email.includes("@")) throw new Error("Please enter a valid email.");

  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("premium_applications")
    .insert({
      name,
      email,
      experience,
      other_groups,
      trading_style,
      discord_alias,
      tradingview_name,
      additional_info,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    throw new Error("Could not submit your application. Please try again.");
  }

  // Email notification (do not block the user if email fails)
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!resendKey) throw new Error("Missing RESEND_API_KEY");
    if (!fromEmail) throw new Error("Missing RESEND_FROM_EMAIL");

    const resend = new Resend(resendKey);

    const subject = `New Premium Application — ${name}`;
    const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/applications`;

    const text = [
      "New Premium Application",
      "----------------------",
      `Name: ${name}`,
      `Email: ${email}`,
      `Discord: ${safeText(discord_alias) || "-"}`,
      `TradingView: ${safeText(tradingview_name) || "-"}`,
      `Trading style: ${safeText(trading_style) || "-"}`,
      "",
      "Experience:",
      experience,
      "",
      "Other groups:",
      other_groups,
      "",
      "Additional info:",
      safeText(additional_info) || "-",
      "",
      `Application ID: ${data?.id ?? "-"}`,
      `Submitted: ${data?.created_at ?? "-"}`,
      adminUrl ? `Admin: ${adminUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await resend.emails.send({
      from: fromEmail,
      to: ["fxtradingstewarth@gmail.com", "haydos@haydosfx.com"],
      subject,
      text,
    });
  } catch (e) {
    console.error("Resend email failed:", e);
  }

  redirect("/premium/apply/success");
}