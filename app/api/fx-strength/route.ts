import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ---------- Types ----------
type Pair = { base: string; quote: string; y: string };
type Strength = Record<string, number>;
type CountryDatum = { iso2: string; currency: string; strength: number };

// ---------- Config ----------
const TTL_SECONDS = 60;
let memoryCache: Record<string, { payload: any; ts: number }> = {}; // keyed by cache key

const PAIRS: Pair[] = [
  { base: "EUR", quote: "USD", y: "EURUSD=X" },
  { base: "GBP", quote: "USD", y: "GBPUSD=X" },
  { base: "AUD", quote: "USD", y: "AUDUSD=X" },
  { base: "NZD", quote: "USD", y: "NZDUSD=X" },
  { base: "USD", quote: "JPY", y: "JPY=X" },
  { base: "USD", quote: "CHF", y: "CHF=X" },
  { base: "USD", quote: "CAD", y: "CAD=X" },

  { base: "EUR", quote: "GBP", y: "EURGBP=X" },
  { base: "EUR", quote: "JPY", y: "EURJPY=X" },
  { base: "EUR", quote: "CHF", y: "EURCHF=X" },
  { base: "EUR", quote: "AUD", y: "EURAUD=X" },
  { base: "EUR", quote: "NZD", y: "EURNZD=X" },
  { base: "EUR", quote: "CAD", y: "EURCAD=X" },
  { base: "EUR", quote: "SEK", y: "EURSEK=X" },
  { base: "EUR", quote: "NOK", y: "EURNOK=X" },

  { base: "GBP", quote: "JPY", y: "GBPJPY=X" },
  { base: "GBP", quote: "CHF", y: "GBPCHF=X" },
  { base: "GBP", quote: "AUD", y: "GBPAUD=X" },
  { base: "GBP", quote: "NZD", y: "GBPNZD=X" },
  { base: "GBP", quote: "CAD", y: "GBPCAD=X" },

  { base: "AUD", quote: "JPY", y: "AUDJPY=X" },
  { base: "NZD", quote: "JPY", y: "NZDJPY=X" },
  { base: "CAD", quote: "JPY", y: "CADJPY=X" },
  { base: "CHF", quote: "JPY", y: "CHFJPY=X" },
  { base: "SEK", quote: "JPY", y: "SEKJPY=X" },
  { base: "NOK", quote: "JPY", y: "NOKJPY=X" },

  { base: "AUD", quote: "CHF", y: "AUDCHF=X" },
  { base: "NZD", quote: "CHF", y: "NZDCHF=X" },
  { base: "CAD", quote: "CHF", y: "CADCHF=X" },
  { base: "AUD", quote: "NZD", y: "AUDNZD=X" },
  { base: "AUD", quote: "CAD", y: "AUDCAD=X" },
  { base: "NZD", quote: "CAD", y: "NZDCAD=X" },

  { base: "USD", quote: "CNH", y: "CNH=X" },
  { base: "USD", quote: "HKD", y: "HKD=X" },
  { base: "USD", quote: "SGD", y: "SGD=X" },
  { base: "USD", quote: "MXN", y: "MXN=X" },
  { base: "USD", quote: "ZAR", y: "ZAR=X" },
];

const COUNTRY_CURRENCY: Record<string, string> = {
  US:"USD", CA:"CAD", MX:"MXN", BR:"BRL", AR:"ARS", CL:"CLP", CO:"COP",
  GB:"GBP", IE:"EUR", FR:"EUR", DE:"EUR", ES:"EUR", IT:"EUR", NL:"EUR", BE:"EUR",
  PT:"EUR", AT:"EUR", FI:"EUR", GR:"EUR", SK:"EUR", SI:"EUR", EE:"EUR", LV:"EUR", LT:"EUR", LU:"EUR",
  CH:"CHF", NO:"NOK", SE:"SEK", DK:"DKK", PL:"PLN", CZ:"CZK", HU:"HUF",
  AU:"AUD", NZ:"NZD", JP:"JPY", CN:"CNH", HK:"HKD", SG:"SGD", KR:"KRW", TW:"TWD", TH:"THB", IN:"INR",
  ZA:"ZAR", AE:"AED", SA:"SAR", IL:"ILS",
};

// ---------- Math ----------
function zscore(values: number[]) {
  const mu = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const sd =
    Math.sqrt(values.reduce((a, b) => a + (b - mu) * (b - mu), 0) / Math.max(values.length, 1)) || 1;
  return { mu, sd };
}

function computeStrengthFromPairs(pairReturns: Record<string, number>): Strength {
  const bucket: Record<string, number[]> = {};
  for (const p of PAIRS) {
    const r = pairReturns[p.y];
    if (!Number.isFinite(r)) continue;
    (bucket[p.base] ||= []).push(r);
    (bucket[p.quote] ||= []).push(-r);
  }
  const strengths: Strength = {};
  for (const c of Object.keys(bucket)) {
    const arr = bucket[c];
    strengths[c] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  const vals = Object.values(strengths);
  const { mu, sd } = zscore(vals);
  for (const k of Object.keys(strengths)) strengths[k] = (strengths[k] - mu) / sd;
  return strengths;
}

function mapCountries(strengths: Strength): CountryDatum[] {
  return Object.entries(COUNTRY_CURRENCY).map(([iso2, ccy]) => ({
    iso2,
    currency: ccy,
    strength: strengths[ccy] ?? 0,
  }));
}

// ---------- Yahoo helpers ----------
async function fetchYahooQuoteBatch(symbols: string[]) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://finance.yahoo.com/",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  return json?.quoteResponse?.result ?? null;
}

async function fetchYahooPricesLive(): Promise<Record<string, { price: number; prev: number }>> {
  const out: Record<string, { price: number; prev: number }> = {};
  // try v7 first
  try {
    const batch = await fetchYahooQuoteBatch(PAIRS.map((p) => p.y));
    if (batch) {
      for (const r of batch) {
        const price = Number(r.regularMarketPrice);
        const prev = Number(r.regularMarketPreviousClose);
        if (Number.isFinite(price) && Number.isFinite(prev) && prev > 0) {
          out[r.symbol] = { price, prev };
        }
      }
    }
  } catch {}
  // fallback: per-symbol chart meta
  const missing = PAIRS.map((p) => p.y).filter((s) => !out[s]);
  const chunk = (arr: string[], n = 6) =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
  for (const group of chunk(missing, 6)) {
    await Promise.all(
      group.map(async (sym) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            sym
          )}?range=1d&interval=1m`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Accept: "application/json,text/plain,*/*",
              Referer: "https://finance.yahoo.com/",
            },
            cache: "no-store",
          });
          if (!res.ok) return;
          const j: any = await res.json();
          const meta = j?.chart?.result?.[0]?.meta;
          const price = Number(meta?.regularMarketPrice);
          const prev = Number(meta?.chartPreviousClose);
          if (Number.isFinite(price) && Number.isFinite(prev) && prev > 0) {
            out[sym] = { price, prev };
          }
        } catch {}
      })
    );
  }
  return out;
}

// Daily closes: choose index (0 = latest close, 1 = previous close, ...)
async function fetchYahooDailyReturns(index: number): Promise<{
  returns: Record<string, number>;
  labelDate: string | null; // ISO date for the chosen day, if available
  available: number; // how many daily bars available
}> {
  const returns: Record<string, number> = {};
  let labelDate: string | null = null;

  const chunk = (arr: Pair[], n = 6) =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

  // we fetch 3 months of daily data so you can step back comfortably
  for (const group of chunk(PAIRS, 6)) {
    await Promise.all(
      group.map(async (p) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            p.y
          )}?range=3mo&interval=1d`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Accept: "application/json,text/plain,*/*",
              Referer: "https://finance.yahoo.com/",
            },
            cache: "no-store",
          });
          if (!res.ok) return;
          const j: any = await res.json();
          const r = j?.chart?.result?.[0];
          const close = r?.indicators?.quote?.[0]?.close as number[] | undefined;
          const ts = r?.timestamp as number[] | undefined;
          if (!close || close.length < 2) return;
          // Find the bar we want: from the END (latest), step back by index
          const last = close.length - 1 - index;
          const prev = last - 1;
          if (last >= 0 && prev >= 0 && Number.isFinite(close[last]) && Number.isFinite(close[prev])) {
            const ret = Math.log(close[last] / close[prev]);
            returns[p.y] = ret;
            if (!labelDate && ts && ts[last]) {
              const d = new Date(ts[last] * 1000);
              labelDate = d.toISOString().slice(0, 10);
            }
          }
        } catch {}
      })
    );
  }

  // available bars is the minimum we likely have across pairs; just return a safe guess (60)
  return { returns, labelDate, available: 60 };
}

// ---------- Handler ----------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") || "intraday").toLowerCase(); // "intraday" | "close"
    const index = Math.max(0, Number(searchParams.get("index") || "0")); // day offset for close mode

    const cacheKey = `${mode}:${index}`;
    const cached = memoryCache[cacheKey];
    if (cached && Date.now() - cached.ts < TTL_SECONDS * 1000) {
      return NextResponse.json(cached.payload);
    }

    let pairReturns: Record<string, number> = {};
    let labelDate: string | null = null;

    if (mode === "close") {
      const { returns, labelDate: lbl } = await fetchYahooDailyReturns(index);
      pairReturns = returns;
      labelDate = lbl;
      if (Object.keys(pairReturns).length === 0) {
        throw new Error("No daily close data available from Yahoo.");
      }
    } else {
      // intraday
      const quotes = await fetchYahooPricesLive();
      for (const p of PAIRS) {
        const q = quotes[p.y];
        if (q) pairReturns[p.y] = Math.log(q.price / q.prev);
      }
      if (Object.keys(pairReturns).length === 0) {
        throw new Error("No intraday quotes available from Yahoo.");
      }
    }

    const strengths = computeStrengthFromPairs(pairReturns);
    const countries = mapCountries(strengths);
    const ranking = Object.entries(strengths)
      .sort((a, b) => b[1] - a[1])
      .map(([currency, z]) => ({ currency, z }));

    const payload = {
      updated: new Date().toISOString(),
      mode,
      index,
      labelDate, // ISO "YYYY-MM-DD" when mode=close (null for intraday)
      strengths,
      countries,
      ranking,
    };

    memoryCache[cacheKey] = { payload, ts: Date.now() };
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to compute FX strength" }, { status: 502 });
  }
}
