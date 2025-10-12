// lib/news/analyze.ts
import crypto from "crypto";

export function cacheKeyFor(item: { url?: string; rawText?: string; promptV?: string }) {
  const base = item.url ?? item.rawText ?? "";
  const v = item.promptV ?? "v1";
  const h = crypto.createHash("sha1").update(base + "::" + v).digest("hex");
  return `news:ana:${v}:${h}`;
}

// Intentionally no prompts here to avoid accidental background calls.
