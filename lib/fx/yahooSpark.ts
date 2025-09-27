// Tiny Yahoo "spark" client (server-side). No changes to your existing lib/pricing needed.

type QuoteEntry = { close?: Array<number | null> };
type ChartResult = {
  meta?: unknown;
  timestamp?: number[];
  indicators?: { quote?: QuoteEntry[] };
};
type SparkResp = {
  chart?: { result?: ChartResult[]; error?: unknown };
};

const Y_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

function isSparkResp(x: unknown): x is SparkResp {
  if (x == null || typeof x !== "object") return false;
  // Loose check is fine; we validate fields when reading them
  return "chart" in x;
}

export async function fetchYahooDailyCloses(
  symbols: string[],
  range: "1mo" | "3mo" | "6mo" | "1y" = "3mo",
  interval: "1d" | "1wk" = "1d"
): Promise<Record<string, { t: string[]; c: number[] }>> {
  const out: Record<string, { t: string[]; c: number[] }> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const u = `${Y_BASE}/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includeAdjustedClose=true`;
        const r = await fetch(u, { cache: "no-store" });
        if (!r.ok) return;

        const jUnknown: unknown = await r.json();
        if (!isSparkResp(jUnknown)) return;
        const j = jUnknown;

        const row = j.chart?.result?.[0];
        const ts = row?.timestamp ?? [];
        if (!Array.isArray(ts) || ts.length === 0) return;

        const closes = row?.indicators?.quote?.[0]?.close ?? [];
        const t = ts.map((s) => new Date(s * 1000).toISOString().slice(0, 10));
        const c = closes.map((x) => (x == null ? NaN : x));

        out[sym] = { t, c };
      } catch {
        // swallow errors per symbol; continue others
      }
    })
  );

  return out;
}
