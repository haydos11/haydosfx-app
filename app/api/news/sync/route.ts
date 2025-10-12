// app/api/news/sync/route.ts
import { NextResponse } from "next/server";
import { fetchCombinedFeeds } from "@/app/(dashboard)/calendar/live-news/server/fetchFeeds";
import { persistNews } from "@/app/(dashboard)/calendar/live-news/server/persist";

export const runtime = "nodejs";

export async function GET() {
  const items = await fetchCombinedFeeds();
  await persistNews(items);
  return NextResponse.json({ ok: true, count: items.length });
}
