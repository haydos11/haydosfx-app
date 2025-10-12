// app/(dashboard)/calendar/live-news/server/fetchRss.ts
import Parser from "rss-parser";
import crypto from "crypto";
import type { NormalizedItem } from "./fetchFeeds";

const FEEDS: { name: string; url: string; stripPrefix?: RegExp }[] = [
  { name: "FinancialJuice", url: "https://www.financialjuice.com/feed.ashx?xy=rss", stripPrefix: /^\s*FinancialJuice\s*[:\-–—]\s*/i },
  { name: "Investing.com",  url: "https://www.investing.com/rss/news.rss",         stripPrefix: /^\s*Investing\.com\s*[:\-–—]\s*/i },
];

// Tell rss-parser what extra fields items may have (contentSnippet)
type RssItem = {
  guid?: string;
  link?: string;
  title?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
};

// ⬇️ Fix: avoid `{}` empty object type
const parser = new Parser<unknown, RssItem>();

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

function cleanTitle(raw: string, rx?: RegExp) {
  const t = rx ? raw.replace(rx, "") : raw;
  return t.replace(/\s+/g, " ").trim();
}

function uniqueKey(
  it: { guid?: string; link?: string; title?: string; isoDate?: string; pubDate?: string },
  source: string
) {
  const guid = String(it.guid ?? "").trim();
  const link = String(it.link ?? "").trim();
  const title = String(it.title ?? "").trim();
  const when  = String(it.isoDate ?? it.pubDate ?? "").trim();
  const primary = guid || link ? `${guid}__${link}` : title;
  return `${source}__${primary}__${when}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "haydosfx-news-bot/1.0",
      "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
    next: { revalidate: 180 },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return await res.text();
}

export async function fetchRssFeeds(): Promise<NormalizedItem[]> {
  const out: NormalizedItem[] = [];
  for (const f of FEEDS) {
    try {
      const xml = await fetchText(f.url);
      const feed = await parser.parseString(xml);

      for (const it of feed.items ?? []) {
        const titleRaw = String(it.title ?? "").trim();
        const link     = String(it.link ?? "").trim();
        if (!titleRaw || !link) continue;

        const title = cleanTitle(titleRaw, f.stripPrefix);
        const key   = uniqueKey(it, f.name);
        const id    = sha1(key);
        const when  = (it.isoDate ?? it.pubDate ?? "").toString();
        const summary = String(it.contentSnippet ?? "").trim().slice(0, 300);

        out.push({
          id,
          title,
          url: link,
          published_at: new Date(when).toISOString(),
          summary,
          source: f.name,
        });
      }
    } catch (e) {
      console.warn(`[rss] ${f.name}:`, (e as Error)?.message ?? e);
    }
  }
  return out;
}
