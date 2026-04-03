import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { yahooCloseOn, inv } from "@/lib/pricing/yahoo";

type PriceMapRow = {
  market_code: string;
  market_name: string | null;
  symbol: string;
  invert_price: boolean;
  price_multiplier: number | null;
  is_active: boolean;
};

type FxIndexPairMapRow = {
  pair_code: string;
  yahoo_symbol: string;
  base_ccy: string;
  quote_ccy: string;
  is_active: boolean;
};

type CotDateRow = {
  market_code: string;
  report_date: string;
};

type ExistingPriceRow = {
  market_code: string;
  price_date: string;
};

type ExistingFxIndexPriceRow = {
  pair_code: string;
  price_date: string;
};

type InsertRow = {
  market_code: string;
  price_date: string;
  close: number | null;
  source: string;
  updated_at: string;
};

type FxIndexInsertRow = {
  pair_code: string;
  price_date: string;
  close: number | null;
  source: string;
  updated_at: string;
};

export type SyncCotMarketPricesResult = {
  ok: boolean;
  marketPricesInserted: number;
  fxHelperPricesInserted: number;
  cutoff: string;
};

// 🔹 FULL MODE (manual rebuild)
function cutoffDate(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

// 🔹 RECENT MODE (cron fast mode)
function cutoffRecent(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function byMarketThenDateAsc(a: CotDateRow, b: CotDateRow): number {
  if (a.market_code < b.market_code) return -1;
  if (a.market_code > b.market_code) return 1;
  return String(a.report_date).localeCompare(String(b.report_date));
}

function isoDate(input: string): string {
  return String(input).slice(0, 10);
}

function addUtcDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getReleaseDate(reportDate: string): string {
  return addUtcDays(reportDate, 3);
}

function applyPriceRules(
  rawClose: number | null,
  mapping: PriceMapRow
): number | null {
  if (rawClose == null) return null;

  let close: number | null = rawClose;

  if (mapping.invert_price) {
    close = inv(close);
  }

  if (close == null) return null;

  if (
    mapping.price_multiplier != null &&
    Number.isFinite(Number(mapping.price_multiplier))
  ) {
    close = close * Number(mapping.price_multiplier);
  }

  return Number.isFinite(close) ? close : null;
}

async function fetchAllCotDates(marketCodes: string[]): Promise<CotDateRow[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let done = false;
  const allRows: CotDateRow[] = [];

  while (!done) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("cot_reports")
      .select("market_code, report_date")
      .in("market_code", marketCodes)
      .order("market_code", { ascending: true })
      .order("report_date", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load COT report dates: ${error.message}`);
    }

    const rows = (data ?? []) as CotDateRow[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      done = true;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

async function fetchAllExistingPrices(
  marketCodes: string[],
  minDate: string
): Promise<ExistingPriceRow[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let done = false;
  const allRows: ExistingPriceRow[] = [];

  while (!done) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("cot_market_prices_daily")
      .select("market_code, price_date")
      .in("market_code", marketCodes)
      .gte("price_date", minDate)
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to load existing market prices: ${error.message}`
      );
    }

    const rows = (data ?? []) as ExistingPriceRow[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      done = true;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

async function fetchAllFxIndexPairMaps(): Promise<FxIndexPairMapRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cot_fx_index_pair_map")
    .select("pair_code, yahoo_symbol, base_ccy, quote_ccy, is_active")
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to load FX index pair map: ${error.message}`);
  }

  return (data ?? []) as FxIndexPairMapRow[];
}

async function fetchAllExistingFxIndexPrices(
  pairCodes: string[],
  minDate: string
): Promise<ExistingFxIndexPriceRow[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 2000;
  let from = 0;
  let done = false;
  const allRows: ExistingFxIndexPriceRow[] = [];

  while (!done) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("cot_fx_index_prices_daily")
      .select("pair_code, price_date")
      .in("pair_code", pairCodes)
      .gte("price_date", minDate)
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to load existing FX index prices: ${error.message}`
      );
    }

    const rows = (data ?? []) as ExistingFxIndexPriceRow[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      done = true;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

// 🔥 MAIN FUNCTION
export async function syncCotMarketPrices(
  mode: "full" | "recent" = "recent"
): Promise<SyncCotMarketPricesResult> {
  const supabase = getSupabaseAdmin();

  const cutoff =
    mode === "full"
      ? cutoffDate(10)
      : cutoffRecent(35); // ✅ THIS FIXES YOUR TIMEOUT

  console.log(`Running price sync in ${mode} mode (cutoff: ${cutoff})`);

  const { data: maps } = await supabase
    .from("cot_market_price_map")
    .select("*")
    .eq("is_active", true);

  const mapRows = (maps ?? []) as PriceMapRow[];
  if (!mapRows.length) {
    return { ok: true, marketPricesInserted: 0, fxHelperPricesInserted: 0, cutoff };
  }

  const fxIndexPairRows = await fetchAllFxIndexPairMaps();

  const marketCodes = mapRows.map((m) => m.market_code);
  const allDates = await fetchAllCotDates(marketCodes);

  const dateRows = allDates
    .filter((r) => isoDate(r.report_date) >= cutoff)
    .sort(byMarketThenDateAsc);

  const existingPrices = await fetchAllExistingPrices(marketCodes, cutoff);
  const existingSet = new Set(
    existingPrices.map((r) => `${r.market_code}__${isoDate(r.price_date)}`)
  );

  const pairCodes = fxIndexPairRows.map((p) => p.pair_code);
  const existingFx = await fetchAllExistingFxIndexPrices(pairCodes, cutoff);
  const existingFxSet = new Set(
    existingFx.map((r) => `${r.pair_code}__${isoDate(r.price_date)}`)
  );

  const marketInsert: InsertRow[] = [];
  const fxInsert: FxIndexInsertRow[] = [];

  for (const row of dateRows) {
    const mapping = mapRows.find((m) => m.market_code === row.market_code);
    if (!mapping) continue;

    const reportDate = isoDate(row.report_date);
    const releaseDate = getReleaseDate(reportDate);

    const reportKey = `${row.market_code}__${reportDate}`;
    const releaseKey = `${row.market_code}__${releaseDate}`;

    if (!existingSet.has(reportKey)) {
      const close = applyPriceRules(
        await yahooCloseOn(mapping.symbol, reportDate),
        mapping
      );

      marketInsert.push({
        market_code: row.market_code,
        price_date: reportDate,
        close,
        source: "yahoo",
        updated_at: new Date().toISOString(),
      });
    }

    if (!existingSet.has(releaseKey)) {
      const close = applyPriceRules(
        await yahooCloseOn(mapping.symbol, releaseDate),
        mapping
      );

      marketInsert.push({
        market_code: row.market_code,
        price_date: releaseDate,
        close,
        source: "yahoo_release",
        updated_at: new Date().toISOString(),
      });
    }
  }

  const neededDates = [...new Set(dateRows.map((r) => isoDate(r.report_date)))];

  for (const pair of fxIndexPairRows) {
    for (const d of neededDates) {
      const key = `${pair.pair_code}__${d}`;
      if (existingFxSet.has(key)) continue;

      const close = await yahooCloseOn(pair.yahoo_symbol, d);

      fxInsert.push({
        pair_code: pair.pair_code,
        price_date: d,
        close,
        source: "yahoo",
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (marketInsert.length) {
    await supabase.from("cot_market_prices_daily").upsert(marketInsert, {
      onConflict: "market_code,price_date",
    });
  }

  if (fxInsert.length) {
    await supabase.from("cot_fx_index_prices_daily").upsert(fxInsert, {
      onConflict: "pair_code,price_date",
    });
  }

  return {
    ok: true,
    marketPricesInserted: marketInsert.length,
    fxHelperPricesInserted: fxInsert.length,
    cutoff,
  };
}