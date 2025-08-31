import { NextResponse } from "next/server";

/**
 * Robust COT fetch:
 * - avoids SoQL select/order to prevent 400s
 * - finds the latest report date client-side
 * - returns [{ name, long, short }] as percentages for major FX CME contracts
 */
export async function GET() {
  const url = "https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=50000";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `CFTC API ${res.status}` }, { status: res.status });
    }

    const rows: any[] = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows from CFTC" }, { status: 502 });
    }

    // Some copies expose report_date_as_yyyy_mm_dd; others use report_date_long
    const getDateStr = (r: any) =>
      (r.report_date_as_yyyy_mm_dd as string) ||
      (r.report_date_long as string) ||
      "";

    // Latest report date across all rows
    const latestDate = rows.reduce<string>((acc, r) => {
      const d = getDateStr(r);
      return d && d > acc ? d : acc;
    }, "");

    const latestRows = latestDate ? rows.filter(r => getDateStr(r) === latestDate) : rows;

    const contains = (r: any, kw: string) =>
      String(r.market_and_exchange_names || "").toLowerCase().includes(kw);

    const findByMarket = (kw: string) =>
      latestRows.find(r => contains(r, kw)) || rows.find(r => contains(r, kw));

    const markets = [
      { key: "australian dollar", label: "AUD (CME)" },
      { key: "british pound",     label: "GBP (CME)" },
      { key: "euro fx",           label: "EUR (CME)" },
      { key: "japanese yen",      label: "JPY (CME)" },
      { key: "canadian dollar",   label: "CAD (CME)" },
      { key: "swiss franc",       label: "CHF (CME)" },
      { key: "new zealand dollar",label: "NZD (CME)" },
    ];

    const out = markets.map(m => {
      const r = findByMarket(m.key);
      const long = Number(r?.noncomm_positions_long_all ?? 0);
      const short = Number(r?.noncomm_positions_short_all ?? 0);
      const total = long + short || 1;
      return {
        name: m.label,
        long: Math.round((long / total) * 100),
        short: Math.round((short / total) * 100),
      };
    });

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "CFTC fetch failed" }, { status: 500 });
  }
}
