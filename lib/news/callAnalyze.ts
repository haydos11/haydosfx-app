export type AnalyzeMeta = {
  url?: string;
  rawText?: string;
  title?: string;
  source?: string;
  publishedAt?: string;
  promptV?: string;
  force?: boolean;
};

export type AnalyzeResponse = {
  key: string;
  url?: string;
  title?: string;
  source?: string;
  publishedAt?: string;
  model: string;
  promptV: string;
  result: {
    summary_bullets: string[];
    why_it_matters: string;
    sentiment: "bullish" | "bearish" | "neutral";
    tags: string[];
    countries: string[];
    tickers: string[];
  };
  cached?: boolean;
};

export async function callAnalyze(meta: AnalyzeMeta): Promise<AnalyzeResponse> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/news/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Analyze request failed (${res.status})`);
  return res.json();
}
