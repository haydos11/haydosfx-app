"use server";
import "server-only";

type PolygonNews = {
  id: string;
  title: string;
  article_url: string;
  published_utc: string;
  description?: string | null;
  source?: string | null;
  tickers?: string[] | null;   // Polygon’s symbols list
};

export type NormalizedItem = {
  id: string;
  title: string;
  url: string;
  published_at: string;
  summary: string;
  source: string;
  symbols?: string[];
  assets?: string[];
};

type Cache = { ts: number; items: NormalizedItem[] };
const G = globalThis as typeof globalThis & { __polygon_news_cache?: Cache };
const TTL = 3 * 60 * 1000;
const BASE = "https://api.polygon.io";

function hasKey(): boolean {
  return !!process.env.POLYGON_API_KEY;
}

async function getPolygonNews(params: Record<string, string | number> = {}) {
  const url = new URL(`${BASE}/v2/reference/news`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("apiKey", process.env.POLYGON_API_KEY!);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Polygon news error ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<{ results?: PolygonNews[] }>;
}

/** Heuristics to infer affected assets from Polygon tickers + headline keywords. */
function inferAssets(tickers: string[] = [], title = ""): string[] {
  const out = new Set<string>();

  for (const t of tickers) {
    if (!t) continue;
    if (t.startsWith("X:")) {               // Crypto
      out.add("Crypto");
      const p = t.split(":")[1];            // e.g., BTCUSD
      if (p) out.add(p);
      if (/BTC/i.test(t)) out.add("BTC");
      if (/ETH/i.test(t)) out.add("ETH");
      continue;
    }
    if (t.startsWith("C:")) {               // Forex
      out.add("FX");
      const p = t.split(":")[1];            // e.g., EURUSD
      if (p) out.add(p);
      continue;
    }
    if (t.startsWith("I:")) {               // Index
      out.add("Index");
      const p = t.split(":")[1];            // e.g., SPX
      if (p) out.add(p);
      continue;
    }
    // Otherwise assume Equity/ETF
    out.add("US Equities");
    out.add(t);
  }

  // Keyword assists (works even when tickers are absent)
  const k = title.toLowerCase();
  if (/\b(fed|powell|treasury|yields|cpi|ppi|jobs|nfp)\b/.test(k)) {
    out.add("USD"); out.add("Rates"); out.add("FX"); out.add("US Equities");
  }
  if (/\b(boe|uk|britain)\b/.test(k)) { out.add("GBP"); out.add("FX"); }
  if (/\b(ecb|euro area|eurozone)\b/.test(k)) { out.add("EUR"); out.add("FX"); }
  if (/\b(boj|japan)\b/.test(k)) { out.add("JPY"); out.add("FX"); }
  if (/\b(opec|brent|wti|crude)\b/.test(k)) { out.add("Commodities"); out.add("Oil"); }
  if (/\b(china)\b/.test(k)) { out.add("CN Equities"); out.add("CNH"); out.add("FX"); }

  return Array.from(out);
}

export async function fetchPolygonNews(limit = 20): Promise<NormalizedItem[]> {
  if (!hasKey()) return [];

  const now = Date.now();
  if (G.__polygon_news_cache && now - G.__polygon_news_cache.ts < TTL) {
    return G.__polygon_news_cache.items;
  }

  const json = await getPolygonNews({ limit, order: "desc" });
  const raw = json.results ?? [];

  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  for (const r of raw) {
    const id = r.id || r.article_url || Math.random().toString(36).slice(2);
    const key = `${id}::${r.article_url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const syms = (r.tickers ?? []).filter(Boolean);
    const assets = inferAssets(syms, r.title || "");

    items.push({
      id,
      title: r.title,
      url: r.article_url,          // ← direct source link
      published_at: r.published_utc,
      summary: r.description ?? "", // AI can enrich further
      source: r.source || "Polygon",
      symbols: syms,
      assets,
    });
  }

  G.__polygon_news_cache = { ts: now, items };
  return items;
}
