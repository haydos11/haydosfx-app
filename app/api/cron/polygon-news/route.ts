import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchPolygonNews } from "@/app/(dashboard)/calendar/live-news/server/fetchPolygonNews";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getLastRun(): Promise<number> {
  const { data } = await supabase.from("kv").select("value").eq("key", "cron:polygon:lastRunMs").single();
  return data?.value ? Number(data.value) : 0;
}

async function setLastRun(ms: number) {
  await supabase
    .from("kv")
    .upsert({ key: "cron:polygon:lastRunMs", value: String(ms) }, { onConflict: "key" });
}

export async function GET() {
  if (!process.env.POLYGON_API_KEY)
    return NextResponse.json({ ok: false, reason: "No POLYGON_API_KEY" });

  const now = Date.now();
  const last = await getLastRun();
  if (now - last < 10 * 60 * 1000)
    return NextResponse.json({ ok: true, skipped: true, reason: "recently ran" });

  const items = await fetchPolygonNews(25);
  if (!items.length)
    return NextResponse.json({ ok: false, reason: "no news returned" });

  const payload = items.map((n) => ({
    id: n.id,
    title: n.title,
    url: n.url,
    source: n.source,
    summary: n.summary ?? "",
    published_at: n.published_at,
  }));

  const { error } = await supabase.from("news_articles").upsert(payload, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message });

  await setLastRun(now);
  return NextResponse.json({ ok: true, upserted: payload.length });
}
