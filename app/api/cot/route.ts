import { NextResponse } from "next/server";

// Shape of a row returned by the CFTC Socrata endpoint
type CftcRow = {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  report_date_long?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
};

export async function GET() {
  const url =
    "https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=50000";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `CFTC API ${res.status}` },
        { status: res.status }
      );
    }

    const rows = (await res.json()) as CftcRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows from CFTC" }, { status: 502 });
    }

    // Normalize date field
    const getDateStr = (r: CftcRow): string =>
      r.report_date_as_yyyy_mm_dd || r.report_date_long || "";

    // Latest report date across rows
    const latestDate = rows.reduce<string>((acc, r) => {
      const d = getDateStr(r);
      return d && d > acc ? d : acc;
    }, "");

    const latestRows = latestDate
      ? rows.filter((r) => getDateStr(r) === latestDate)
      : rows;

    const contains = (r: CftcRow, kw: string): boolean =>
      (r.market_and_exchange_names ?? "").toLowerCase().includes(kw);

    const findByMarket = (kw: string): CftcRow | undefined =>
      latestRows.find((r) => contains(r, kw)) ||
      rows.find((r) => contains(r, kw));

    const markets: { key: string; label: string }[] = [
      { key: "australian dollar", label: "AUD (CME)" },
      { key: "british pound", label: "GBP (CME)" },
      { key: "euro fx", label: "EUR (CME)" },
      { key: "japanese yen", label: "JPY (CME)" },
      { key: "canadian dollar", label: "CAD (CME)" },
      { key: "swiss franc", label: "CHF (CME)" },
      { key: "new zealand dollar", label: "NZD (CME)" },
    ];

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

    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CFTC fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
