// app/(dashboard)/calendar/live-news/server/fetchFeeds.ts
import Parser from "rss-parser";
import crypto from "crypto";

/* ---------------- types ---------------- */
export type NormalizedItem = {
  id: string;
  title: string;
  url: string;
  published_at: string; // ISO
  summary: string;
  source: string;       // keep flexible for future sources
};

/* ---------------- sources (FinancialJuice only) ---------------- */
const FEEDS: { name: string; url: string }[] = [
  { name: "FinancialJuice", url: "https://www.financialjuice.com/feed.ashx?xy=rss" },
  // Add more sources later (e.g. ECB/BoE/etc.)
];

const parser = new Parser();

// tiny in-memory cache to smooth brief outages/rate limits
type NewsCache = { ts: number; items: NormalizedItem[] };
const G = globalThis as typeof globalThis & { __news_cache?: NewsCache };

const MEMO_TTL_MS = 5 * 60 * 1000;

/* ---------------- helpers ---------------- */
function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}
function toISO(d?: string) {
  try { return d ? new Date(d).toISOString() : new Date().toISOString(); }
  catch { return new Date().toISOString(); }
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** strip provider prefixes like "FinancialJuice:" from titles */
function cleanTitle(raw: string) {
  return raw
    .replace(/^\s*FinancialJuice\s*[:\-–—]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** stable uniqueness key (includes source to avoid cross-source collisions) */
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

/** Next.js cached fetch + polite retry for 429/5xx */
async function fetchTextWithCache(url: string): Promise<string> {
  const headers: Record<string,string> = {
    "User-Agent": "haydosfx-news-bot/1.0 (+https://haydosfx.com)",
    "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  };
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, { headers, next: { revalidate: 180 } });
    if (res.ok) return await res.text();
    if (res.status === 429 || res.status >= 500) {
      const delay = Math.min(1500 * 2 ** (attempt - 1) + Math.random() * 300, 6000);
      await sleep(delay);
      continue;
    }
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  throw new Error(`Fetch failed after retries for ${url}`);
}

/* ---------------- main export ---------------- */
export async function fetchCombinedFeeds(): Promise<NormalizedItem[]> {
  const now = Date.now();
  try {
    const all: NormalizedItem[] = [];

    for (const f of FEEDS) {
      try {
        const xml  = await fetchTextWithCache(f.url);
        const feed = await parser.parseString(xml);

        for (const it of feed.items ?? []) {
          const titleRaw = String(it.title ?? "").trim();
          const link     = String(it.link ?? "").trim();
          if (!titleRaw || !link) continue;

          const title = cleanTitle(titleRaw);
          const key   = uniqueKey(
            {
              guid: it.guid as string | undefined,
              link: it.link as string | undefined,
              title,
              isoDate: it.isoDate as string | undefined,
              pubDate: it.pubDate as string | undefined,
            },
            f.name
          );

          const id        = sha1(key);
          const when      = (it.isoDate ?? it.pubDate ?? "").toString();
          const summary   = String(it.contentSnippet ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);

          all.push({
            id,
            title,
            url: link,
            published_at: toISO(when),
            summary,
            source: f.name,
          });
        }
      } catch (err) {
        console.warn(`[news] ${f.name} fetch error:`, (err as Error)?.message ?? err);
      }
    }

    // de-dupe & sort
    const seen = new Set<string>();
    const items = all.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
    items.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    G.__news_cache = { ts: now, items };
    return items;
  } catch (err) {
    const cached = G.__news_cache;
    if (cached && now - cached.ts < MEMO_TTL_MS) {
      console.warn("[news] using memoized cache due to error:", (err as Error)?.message ?? err);
      return cached.items;
    }
    console.warn("[news] no cache available; returning empty:", (err as Error)?.message ?? err);
    return [];
  }
}
