// app/(dashboard)/calendar/live-news/server/persist.ts
import { createClient } from "@supabase/supabase-js";
import type { NormalizedItem } from "./fetchFeeds";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

export async function persistNews(items: NormalizedItem[]) {
  if (!items.length) return;

  // Upsert in small batches
  const chunk = 200;
  for (let i = 0; i < items.length; i += chunk) {
    const slice = items.slice(i, i + chunk).map((x) => ({
      id: x.id,
      title: x.title,
      url: x.url,
      source: x.source,
      summary: x.summary,
      published_at: x.published_at,
    }));

    const { error } = await supabase
      .from("news_articles")
      .upsert(slice, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
      console.error("[news] upsert error:", error.message);
    }
  }
}
