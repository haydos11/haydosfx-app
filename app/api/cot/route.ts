// app/api/cot/route.ts
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

type CftcRow = {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  report_date_long?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
};

const KEY = "cot:summary:v1";
const TTL_SECONDS = 60 * 60 * 8;
const FALLBACK_URL = "https://data.cftc.gov/resource/6dca-aqww.json";

function getDateStr(r: CftcRow) {
  return r.report_date_as_yyyy_mm_dd || r.report_date_long || "";
}
function contains(r: CftcRow, kw: string) {
  return (r.market_and_exchange_names ?? "").toLowerCase().includes(kw);
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const refresh = u.searchParams.get("refresh") === "1";
  const base = process.env.CFTC_URL || FALLBACK_URL; // should be 9qbp-8g3m.json
  const url = base.includes("?") ? base : `${base}?$limit=50000`;

  try {
    if (!refresh) {
      const cached = await kv.get(KEY);
      if (cached) return NextResponse.json(cached);
    }

    // Pull from CFTC
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `CFTC HTTP ${res.status} ${res.statusText}`, url },
        { status: res.status }
      );
    }

    const rows = (await res.json()) as CftcRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows from CFTC", url },
        { status: 502 }
      );
    }

    // Latest report only
    const latestDate = rows.reduce<string>((acc, r) => {
      const d = getDateStr(r);
      return d && d > acc ? d : acc;
    }, "");
    const latestRows = latestDate ? rows.filter((r) => getDateStr(r) === latestDate) : rows;

    const markets = [
      { key: "australian dollar", label: "AUD (CME)" },
      { key: "british pound",     label: "GBP (CME)" },
      { key: "euro fx",           label: "EUR (CME)" },
      { key: "japanese yen",      label: "JPY (CME)" },
      { key: "canadian dollar",   label: "CAD (CME)" },
      { key: "swiss franc",       label: "CHF (CME)" },
      { key: "new zealand dollar",label: "NZD (CME)" },
    ];

    const findByMarket = (kw: string): CftcRow | undefined =>
      latestRows.find((r) => contains(r, kw)) || rows.find((r) => contains(r, kw));

    const out = markets.map(({ key, label }) => {
      const r = findByMarket(key);
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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error", url },
      { status: 500 }
    );
  }
}
