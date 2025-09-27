// app/api/cot/route.ts
import { NextResponse } from "next/server";
import { MARKETS, type MarketGroup } from "@/lib/cot/markets";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** ---------- Types ---------- */
type Row = {
  report_date_as_yyyy_mm_dd?: string;
  report_date_long?: string;
  market_and_exchange_names?: string;
  contract_market_name?: string;
  noncomm_positions_long_all?: string | number;
  noncomm_positions_short_all?: string | number;
  noncomm_positions_spread_all?: string | number;
  change_in_noncomm_long_all?: string | number;
  change_in_noncomm_short_all?: string | number;
  pct_of_oi_noncomm_long_all?: string | number;
  pct_of_oi_noncomm_short_all?: string | number;
};

type ApiBase = {
  updated: string;
  range: { start: string; end: string; years?: number | null; label?: string };
  count: number;
};

type ApiRows = ApiBase & { rows: Row[] };

type DistRow = {
  market: string; // contract_market_name (short)
  date: string;   // YYYY-MM-DD
  long: number;
  short: number;
  net: number;    // long - short
  pctLong?: number | null;
  pctShort?: number | null;
};

type ApiDistribution = ApiBase & {
  rows: Row[];             // raw rows for tables/drilldown
  distribution: DistRow[]; // latest snapshot per market
};

/** ---------- Config ---------- */
const DEFAULT_YEARS = 5;
const MAX_YEARS = 15;
const MAX_ROWS = 120_000;

const CFTC_URL =
  process.env.CFTC_URL ||
  "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const SELECT = [
  "report_date_as_yyyy_mm_dd",
  "report_date_long",
  "market_and_exchange_names",
  "contract_market_name",
  "noncomm_positions_long_all",
  "noncomm_positions_short_all",
  "noncomm_positions_spread_all",
  "change_in_noncomm_long_all",
  "change_in_noncomm_short_all",
  "pct_of_oi_noncomm_long_all",
  "pct_of_oi_noncomm_short_all",
].join(", ");

/** ---------- Legacy scopes (whitelists) ---------- */
const G8_FX_NAMES = [
  "EURO FX",
  "BRITISH POUND STERLING",
  "AUSTRALIAN DOLLAR",
  "NEW ZEALAND DOLLAR",
  "CANADIAN DOLLAR",
  "SWISS FRANC",
  "JAPANESE YEN",
  "U.S. DOLLAR INDEX",
];

/** ---------- Utils ---------- */
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const startOfYear = (d = new Date()) => new Date(d.getFullYear(), 0, 1);
const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
};
const numeric = (n: unknown): number => {
  const v = typeof n === "string" ? Number(n) : (n as number | undefined);
  return Number.isFinite(v) ? (v as number) : 0;
};

function resolveRange(sp: URLSearchParams): { start: string; end: string; years?: number | null; label?: string } {
  const todayISO = toISODate(new Date());
  const startParam = sp.get("start");
  const endParam = sp.get("end");
  const yearsParam = sp.get("years");
  const rangeParam = sp.get("range")?.toLowerCase();

  // Explicit start/end wins
  if (startParam || endParam) {
    return {
      start: startParam || toISODate(yearsAgo(DEFAULT_YEARS)),
      end: endParam || todayISO,
      years: null,
      label: "custom",
    };
  }

  // Legacy years param
  if (yearsParam) {
    const y = clamp(Number(yearsParam) || DEFAULT_YEARS, 1, MAX_YEARS);
    return { start: toISODate(yearsAgo(y)), end: todayISO, years: y, label: `${y}y` };
  }

  // New range presets
  switch (rangeParam) {
    case "ytd": return { start: toISODate(startOfYear()), end: todayISO, years: null, label: "ytd" };
    case "1y":  return { start: toISODate(yearsAgo(1)),  end: todayISO, years: 1,    label: "1y" };
    case "3y":  return { start: toISODate(yearsAgo(3)),  end: todayISO, years: 3,    label: "3y" };
    case "5y":
    case undefined:
    case null:  return { start: toISODate(yearsAgo(5)),  end: todayISO, years: 5,    label: "5y" };
    case "max": return { start: "1900-01-01", end: todayISO, years: null, label: "max" };
    default:    return { start: toISODate(yearsAgo(5)),  end: todayISO, years: 5,    label: "5y" };
  }
}

/** ---------- Memory cache ---------- */
const TTL_SECONDS = 60 * 60 * 4;
const memory: Record<string, { ts: number; payload: ApiRows | ApiDistribution }> = {};

/** ---------- Route ---------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;

    // filters
    const refresh = sp.get("refresh") === "1";
    const scope = (sp.get("scope") || "").toLowerCase();       // "", "g8", "fx" (legacy)
    const format = (sp.get("format") || "rows").toLowerCase(); // "rows" | "distribution"
    const group = sp.get("group") as MarketGroup | null;        // e.g., "FX" (from registry)

    // date range
    const { start, end, years, label } = resolveRange(sp);

    /** ----- WHERE clause ----- */
    const whereParts: string[] = [
      // use timestamps for precise SoQL filtering
      `report_date_as_yyyy_mm_dd >= '${start}T00:00:00.000'`,
      `report_date_as_yyyy_mm_dd <= '${end}T00:00:00.000'`,
    ];

    // Prefer registry-driven group if provided
    if (group) {
      const names = MARKETS
        .filter(m => m.group === group)
        .map(m => m.cftcName.replace(/'/g, "''"));
      if (names.length) {
        whereParts.push(
          `market_and_exchange_names in (${names.map(n => `'${n}'`).join(", ")})`
        );
      }
    } else if (scope === "g8") {
      // Legacy: G8 shortlist via contract_market_name
      const inList = G8_FX_NAMES.map(n => `'${n.replace(/'/g, "''")}'`).join(", ");
      whereParts.push(`contract_market_name in (${inList})`);
    } else if (scope === "fx") {
      // Legacy: heuristic FX filter
      whereParts.push(
        `(upper(contract_market_name) like '%DOLLAR%' OR upper(contract_market_name) like '%EURO%' OR upper(contract_market_name) like '%YEN%' OR upper(contract_market_name) like '%FRANC%' OR upper(contract_market_name) like '%POUND%' OR upper(contract_market_name) like '%INDEX%')`
      );
    }

    const WHERE = whereParts.join(" AND ");

    const params = new URLSearchParams();
    params.set("$select", SELECT);
    params.set("$where", WHERE);
    params.set("$order", "report_date_as_yyyy_mm_dd desc, contract_market_name asc");
    params.set("$limit", String(MAX_ROWS));

    const queryKey = `v3:${start}:${end}:${scope}:${group ?? ""}:${format}`;
    const now = Math.floor(Date.now() / 1000);

    if (!refresh && memory[queryKey] && now - memory[queryKey].ts < TTL_SECONDS) {
      return NextResponse.json(memory[queryKey].payload, {
        headers: { "Cache-Control": `public, max-age=${TTL_SECONDS}` },
      });
    }

    const r = await fetch(`${CFTC_URL}?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `CFTC fetch failed (${r.status})`, detail: text },
        { status: r.status }
      );
    }

    const rows = (await r.json()) as Row[];

    const base: ApiBase = {
      updated: new Date().toISOString(),
      range: { start, end, years, label },
      count: rows.length,
    };

    if (format === "distribution") {
      // rows are sorted desc by date; first seen market = latest snapshot
      const seen = new Set<string>();
      const distribution: DistRow[] = [];

      for (const row of rows) {
        const market = row.contract_market_name?.trim();
        const date = row.report_date_as_yyyy_mm_dd;
        if (!market || !date) continue;
        if (seen.has(market)) continue;
        seen.add(market);

        const long = numeric(row.noncomm_positions_long_all);
        const short = numeric(row.noncomm_positions_short_all);

        distribution.push({
          market,
          date,
          long,
          short,
          net: long - short,
          pctLong: Number.isFinite(Number(row.pct_of_oi_noncomm_long_all))
            ? Number(row.pct_of_oi_noncomm_long_all)
            : null,
          pctShort: Number.isFinite(Number(row.pct_of_oi_noncomm_short_all))
            ? Number(row.pct_of_oi_noncomm_short_all)
            : null,
        });
      }

      const payload: ApiDistribution = { ...base, rows, distribution };
      memory[queryKey] = { ts: now, payload };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": `public, max-age=${TTL_SECONDS}` },
      });
    }

    // default: raw rows (tables/drilldown)
    const payload: ApiRows = { ...base, rows };
    memory[queryKey] = { ts: now, payload };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": `public, max-age=${TTL_SECONDS}` },
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Unhandled error in /api/cot", detail },
      { status: 500 }
    );
  }
}
