import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { errorMessage } from "@/app/lib/errorMessage";

type Row = {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  report_date_long?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
};

const KEY = "cot:summary:v1";
const TTL_SECONDS = 60 * 60 * 8;
const BASE =
  process.env.CFTC_URL || "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const SELECT = [
  "report_date_as_yyyy_mm_dd",
  "report_date_long",
  "market_and_exchange_names",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
].join(",");

function dateStr(r: Row) {
  return r.report_date_as_yyyy_mm_dd || r.report_date_long || "";
}
function contains(r: Row, kw: string) {
  return (r.market_and_exchange_names ?? "").toLowerCase().includes(kw);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  if (!refresh) {
    const cached = await kv.get(KEY);
    if (cached) return NextResponse.json(cached);
  }

  const params = new URLSearchParams({
    $select: SELECT,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: "15000",
  });

  const fetchUrl = `${BASE}?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(fetchUrl, { cache: "no-store" });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Network error: ${errorMessage(e)}`, url: fetchUrl },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `CFTC HTTP ${res.status} ${res.statusText}`, url: fetchUrl },
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
    const long = Number(r?.noncomm_positions_long_all ?? 0);
    const short = Number(r?.noncomm_positions_short_all ?? 0);
    const total = long + short || 1;
    return {
      name: label,
      long: Math.round((long / total) * 100),
      short: Math.round((short / total) * 100),
    };
  });

  await kv.set(KEY, out, { ex: TTL_SECONDS });
  return NextResponse.json(out);
}
