import type { RawCotRow } from "./types";

const CFTC_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const PAGE = 50_000;

function qs(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function escSql(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

type MatchSpec = {
  longNames: string[];
  shortNames: string[];
  excludeLike?: string[];
};

const MATCH_SPECS: Record<string, MatchSpec> = {
  "EURO FX - CHICAGO MERCANTILE EXCHANGE": {
    longNames: ["EURO FX - CHICAGO MERCANTILE EXCHANGE"],
    shortNames: ["EURO FX"],
    excludeLike: ["E-MINI%", "E MICRO%", "E-MICRO%", "%/%"],
  },

  "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE": {
    longNames: [
      "NEW ZEALAND DOLLAR - CHICAGO MERCANTILE EXCHANGE",
      "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE",
    ],
    shortNames: ["NEW ZEALAND DOLLAR", "NZ DOLLAR"],
    excludeLike: ["E-MINI%", "E MICRO%", "E-MICRO%", "%/%"],
  },

  "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE": {
    longNames: [
      "BRITISH POUND STERLING - CHICAGO MERCANTILE EXCHANGE",
      "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE",
    ],
    shortNames: ["BRITISH POUND STERLING", "BRITISH POUND"],
    excludeLike: ["E-MINI%", "E MICRO%", "E-MICRO%", "%/%"],
  },

  "BRENT CRUDE OIL LAST DAY - NEW YORK MERCANTILE EXCHANGE": {
    longNames: [
      "BRENT CRUDE OIL LAST DAY - NEW YORK MERCANTILE EXCHANGE",
      "BRENT LAST DAY - NEW YORK MERCANTILE EXCHANGE",
    ],
    shortNames: ["BRENT CRUDE OIL LAST DAY", "BRENT LAST DAY"],
  },

  "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE": {
    longNames: [
      "CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE",
      "CRUDE OIL, LIGHT SWEET-WTI - NEW YORK MERCANTILE EXCHANGE",
      "WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE",
    ],
    shortNames: [
      "CRUDE OIL, LIGHT SWEET",
      "CRUDE OIL, LIGHT SWEET-WTI",
      "WTI-PHYSICAL",
    ],
  },

  "GASOLINE BLENDSTOCK (RBOB) - NEW YORK MERCANTILE EXCHANGE": {
    longNames: [
      "GASOLINE BLENDSTOCK (RBOB) - NEW YORK MERCANTILE EXCHANGE",
      "GASOLINE BLENDSTOCK (RBOB)  - NEW YORK MERCANTILE EXCHANGE",
      "GASOLINE RBOB - NEW YORK MERCANTILE EXCHANGE",
    ],
    shortNames: [
      "GASOLINE BLENDSTOCK (RBOB)",
      "GASOLINE RBOB",
    ],
  },

  "COPPER-GRADE #1 - COMMODITY EXCHANGE INC.": {
    longNames: [
      "COPPER-GRADE #1 - COMMODITY EXCHANGE INC.",
      "COPPER- #1 - COMMODITY EXCHANGE INC.",
    ],
    shortNames: ["COPPER-GRADE #1", "COPPER- #1"],
  },

  "NAT GAS ICE LD1 - ICE FUTURES ENERGY DIV": {
    longNames: [
      "NAT GAS ICE LD1 - ICE FUTURES ENERGY DIV",
      "NAT GAS ICE LD1 - ICE FUTURES ENERGY DIV  ",
    ],
    shortNames: ["NAT GAS ICE LD1"],
  },
};

function defaultMatchSpec(cftcName: string): MatchSpec {
  const baseShort = cftcName.split(" - ")[0].trim();

  const shortNames = Array.from(
    new Set([baseShort, baseShort.replace(/\s+STERLING\b/i, "").trim()])
  );

  return {
    longNames: [cftcName],
    shortNames,
    excludeLike: ["E-MINI%", "E MICRO%", "E-MICRO%", "%/%"],
  };
}

function whereForMarket(cftcName: string): string {
  const key = normalizeKey(cftcName);
  const spec = MATCH_SPECS[key] ?? defaultMatchSpec(cftcName);

  const longMatch = spec.longNames
    .map(
      (name) =>
        `UPPER(market_and_exchange_names) = '${escSql(normalizeKey(name))}'`
    )
    .join(" OR ");

  const shortMatch = spec.shortNames
    .map((name) => {
      const norm = escSql(normalizeKey(name));
      return `(UPPER(contract_market_name) = '${norm}' OR UPPER(contract_market_name) LIKE '${norm}%')`;
    })
    .join(" OR ");

  const excludes = (spec.excludeLike ?? [])
    .map((pattern) => {
      const p = escSql(pattern.toUpperCase());
      return `NOT (
        UPPER(COALESCE(contract_market_name, '')) LIKE '${p}'
        OR UPPER(COALESCE(market_and_exchange_names, '')) LIKE '${p}'
      )`;
    })
    .join(" AND ");

  return `(
    (${longMatch})
    OR
    (${shortMatch})
  )${excludes ? ` AND ${excludes}` : ""}`;
}

async function fetchOneMarket(
  market: string,
  startDate?: string | null
): Promise<RawCotRow[]> {
  const select = [
    "report_date_as_yyyy_mm_dd",
    "market_and_exchange_names",
    "contract_market_name",
    "noncomm_positions_long_all",
    "noncomm_positions_short_all",
    "comm_positions_long_all",
    "comm_positions_short_all",
    "nonrept_positions_long_all",
    "nonrept_positions_short_all",
    "open_interest_all",
  ].join(",");

  const whereParts = [whereForMarket(market)];

  if (startDate) {
    whereParts.push(`report_date_as_yyyy_mm_dd >= '${escSql(startDate)}'`);
  }

  const where = whereParts.join(" AND ");
  const order = "report_date_as_yyyy_mm_dd DESC, market_and_exchange_names ASC";

  let all: RawCotRow[] = [];
  let offset = 0;

  while (true) {
    const url = `${CFTC_URL}?${qs({
      $select: select,
      $where: where,
      $order: order,
      $limit: PAGE,
      $offset: offset,
    })}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CFTC fetch failed for "${market}" (${res.status}): ${text}`);
    }

    const batch = (await res.json()) as RawCotRow[];
    all = all.concat(batch);

    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  return all;
}

export async function fetchRawCotData(
  markets: string[],
  startDate?: string | null
): Promise<RawCotRow[]> {
  if (!markets.length) return [];

  let all: RawCotRow[] = [];

  for (const market of markets) {
    const rows = await fetchOneMarket(market, startDate);
    all = all.concat(rows);
  }

  return all;
}