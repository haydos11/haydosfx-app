// app/api/cot/route.ts
import { NextResponse } from "next/server";

/**
 * Pulls latest COT (Disaggregated Futures & Options Combined) from the CFTC Socrata API
 * and returns [{ name, long, short }] with percentages for major FX futures.
 *
 * Notes:
 * - We select only the fields we need and order by report_date_long DESC (latest first)
 * - We then pick the first row for each market keyword
 */
export async function GET() {
  // Socrata: Disaggregated Futures and Options Combined
  // Fields we care about:
  // - market_and_exchange_names (e.g., "Australian Dollar - Chicago Mercantile Exchange")
  // - report_date_long (YYYY-MM-DD)
  // - noncomm_positions_long_all
  // - noncomm_positions_short_all
  const url =
    "https://publicreporting.cftc.gov/resource/6dca-aqww.json" +
    "?$select=market_and_exchange_names,report_date_long,noncomm_positions_long_all,noncomm_positions_short_all" +
    "&$order=report_date_long%20DESC" +
    "&$limit=2000";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("CFTC API error");
    const rows: any[] = await res.json();

    // Helper to find the latest matching row for a given keyword
    const pick = (keyword: string) =>
      rows.find(r =>
        String(r.market_and_exchange_names || "")
          .toLowerCase()
          .includes(keyword.toLowerCase())
      );

    // FX markets we want (CME contracts)
    const markets = [
      { key: "Australian Dollar", label: "AUD (CME)" },
      { key: "British Pound",    label: "GBP (CME)" },
      { key: "Euro FX",          label: "EUR (CME)" },
      { key: "Japanese Yen",     label: "JPY (CME)" },
      { key: "Canadian Dollar",  label: "CAD (CME)" },
      { key: "Swiss Franc",      label: "CHF (CME)" },
      { key: "New Zealand Dollar", label: "NZD (CME)" },
    ];

    const mapped = markets.map(m => {
      const r = pick(m.key);
      const long = Number(r?.noncomm_positions_long_all ?? 0);
      const short = Number(r?.noncomm_positions_short_all ?? 0);
      const total = long + short || 1;
      return {
        name: m.label,
        long: Math.round((long / total) * 100),
        short: Math.round((short / total) * 100),
      };
    });

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("COT fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch COT data" },
      { status: 500 }
    );
  }
}
