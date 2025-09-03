import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { errorMessage } from "@/app/lib/errorMessage";

type Row = {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
};

const KEY = "cot:summary:v1";
const TTL_SECONDS = 60 * 60 * 8;

// Financial futures (combined) dataset
const CFTC_URL =
  process.env.CFTC_URL ||
  "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

// Only include columns that actually exist on 6dca-aqww
const SELECT = [
  "report_date_as_yyyy_mm_dd",
  "market_and_exchange_names",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
].join(", ");

// Build a single SoQL query string
const QUERY = `SELECT ${SELECT} ORDER BY report_date_as_yyyy_mm_dd DESC LIMIT 15000`;

function dateStr(r: Row) {
  return r.report_date_as_yyyy_mm_dd || "";
}

function contains(r: Row, kw: string) {
  const hay = (r.market_and_exchange_names ?? "").toLowerCase();
  return hay.includes(kw.toLowerCase());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  if (!refresh) {
    const cached = await kv.get(KEY);
    if (cached) return NextResponse.json(cached);
  }

  // Build URL using $query=SoQL
  const fetchUrl = `${CFTC_URL}?$query=${encodeURIComponent(QUERY)}`;

  // Optional: Socrata app token for higher rate limits
  const headers: Record<string, string> = {};
  if (process.env.SOCRATA_APP_TOKEN) {
    headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  }

  let res: Response;
  try {
    res = await fetch(fetchUrl, { cache: "no-store", headers });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Network error: ${errorMessage(e)}`, url: fetchUrl },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      {
        error: `CFTC HTTP ${res.status} ${res.statusText}`,
        url: fetchUrl,
        body: body?.slice(0, 500),
      },
      { status: res.status }
    );
  }

  const rows = (await res.json()) as Row[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "No rows from CFTC", url: fetchUrl },
      { status: 502 }
    );
  }

  // Identify the latest report date (lexicographic works for YYYY-MM-DD)
  const latest = rows.reduce<string>((acc, r) => {
    const x = dateStr(r);
    return x && x > acc ? x : acc;
  }, "");

  const latestRows = latest ? rows.filter((r) => dateStr(r) === latest) : rows;

  const markets = [
    { key: "australian dollar", label: "AUD (CME)" },
    { key: "british pound", label: "GBP (CME)" },
    { key: "euro fx", label: "EUR (CME)" },
    { key: "japanese yen", label: "JPY (CME)" },
    { key: "canadian dollar", label: "CAD (CME)" },
    { key: "swiss franc", label: "CHF (CME)" },
    { key: "new zealand dollar", label: "NZD (CME)" },
  ];

  const find = (kw: string) =>
    latestRows.find((r) => contains(r, kw)) || rows.find((r) => contains(r, kw));

  const out = markets.map(({ key, label }) => {
    const r = find(key);
    const long = Number(r?.noncomm_positions_long_all ?? 0) || 0;
    const short = Number(r?.noncomm_positions_short_all ?? 0) || 0;
    const total = long + short;

    return {
      name: label,
      long: total > 0 ? Math.round((long / total) * 100) : 0,
      short: total > 0 ? Math.round((short / total) * 100) : 0,
    };
  });

  await kv.set(KEY, out, { ex: TTL_SECONDS });
  return NextResponse.json(out);
}
