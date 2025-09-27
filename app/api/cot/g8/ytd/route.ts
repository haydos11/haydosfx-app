// app/api/cot/g8/ytd/route.ts (or wherever this lives)
import { NextResponse } from "next/server";

type CftcRow = {
  report_date_as_yyyy_mm_dd: string;
  market_and_exchange_names: string;
  contract_market_name?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
};

type OutRow = {
  date: string;
  market: string;
  contract: string;
  long: number;
  short: number;
  net: number;
};

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const MARKETS = [
  "EURO FX - CHICAGO MERCANTILE EXCHANGE",
  "JAPANESE YEN - CHICAGO MERCANTILE EXCHANGE",
  "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE",
  "AUSTRALIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
  "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE",
  "CANADIAN DOLLAR - CHICAGO MERCANTILE EXCHANGE",
  "SWISS FRANC - CHICAGO MERCANTILE EXCHANGE",
  "U.S. DOLLAR INDEX - ICE FUTURES U.S.",
];

function toISODateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const url = new URL(CFTC_URL);
    url.searchParams.set(
      "$select",
      [
        "report_date_as_yyyy_mm_dd",
        "market_and_exchange_names",
        "contract_market_name",
        "noncomm_positions_long_all",
        "noncomm_positions_short_all",
      ].join(", ")
    );

    // YTD (use Jan 1 of current year) — adjust if you truly want fixed 2020 start
    const start = `${new Date().getFullYear()}-01-01`;

    url.searchParams.set(
      "$where",
      `report_date_as_yyyy_mm_dd >= '${start}' AND market_and_exchange_names in (${MARKETS.map(
        (m) => `'${m.replace(/'/g, "''")}'`
      ).join(", ")})`
    );
    url.searchParams.set("$order", "report_date_as_yyyy_mm_dd asc");
    url.searchParams.set("$limit", "50000");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        {
          updated: new Date().toISOString(),
          universe: "G8",
          rows: [] as OutRow[],
          error: `CFTC ${res.status}${detail ? `: ${detail}` : ""}`,
        },
        { status: res.status }
      );
    }

    const raw = (await res.json()) as CftcRow[];

    const rows: OutRow[] = raw.map((r) => {
      const Lraw = r.noncomm_positions_long_all ?? 0;
      const Sraw = r.noncomm_positions_short_all ?? 0;
      const L = Number(Lraw);
      const S = Number(Sraw);
      const long = Number.isFinite(L) ? L : 0;
      const short = Number.isFinite(S) ? S : 0;

      return {
        date: r.report_date_as_yyyy_mm_dd ?? toISODateOnly(new Date()),
        market: r.market_and_exchange_names,
        contract: r.contract_market_name || r.market_and_exchange_names,
        long,
        short,
        net: long - short,
      };
    });

    return NextResponse.json({
      updated: new Date().toISOString(),
      universe: "G8",
      rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      updated: new Date().toISOString(),
      universe: "G8",
      rows: [] as OutRow[],
      error: msg || "Unknown error",
    });
  }
}
