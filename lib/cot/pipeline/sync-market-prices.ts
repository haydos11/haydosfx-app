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

function cutoffDate(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

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

async function fetchAllCotDates(
  marketCodes: string[],
  minDate: string
): Promise<CotDateRow[]> {
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
      .gte("report_date", minDate)
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
    .eq("is_active", true)
    .order("pair_code", { ascending: true });

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

export async function syncCotMarketPrices(
  mode: "full" | "recent" = "recent"
): Promise<SyncCotMarketPricesResult> {
  const supabase = getSupabaseAdmin();

  const cutoff = mode === "full" ? cutoffDate(10) : cutoffRecent(35);

  console.log(`[price-sync] mode=${mode} cutoff=${cutoff}`);

  const { data: maps, error: mapsError } = await supabase
    .from("cot_market_price_map")
    .select(
      "market_code, market_name, symbol, invert_price, price_multiplier, is_active"
    )
    .eq("is_active", true)
    .order("market_code", { ascending: true });

  if (mapsError) {
    throw new Error(`Failed to load cot_market_price_map: ${mapsError.message}`);
  }

  const mapRows = (maps ?? []) as PriceMapRow[];

  if (!mapRows.length) {
    console.log("[price-sync] No active price mappings found.");
    return {
      ok: true,
      marketPricesInserted: 0,
      fxHelperPricesInserted: 0,
      cutoff,
    };
  }

  const fxIndexPairRows = await fetchAllFxIndexPairMaps();

  console.log(
    `[price-sync] Loaded ${mapRows.length} active market mappings.`
  );
  console.log(
    `[price-sync] Loaded ${fxIndexPairRows.length} active FX index pairs.`
  );

  const marketCodes = mapRows.map((m) => m.market_code);
  const allDates = await fetchAllCotDates(marketCodes, cutoff);

  if (!allDates.length) {
    console.log("[price-sync] No COT report dates found for mapped markets.");
    return {
      ok: true,
      marketPricesInserted: 0,
      fxHelperPricesInserted: 0,
      cutoff,
    };
  }

  const dateRows = allDates.slice().sort(byMarketThenDateAsc);

  console.log(
    `[price-sync] Using ${dateRows.length} recent COT rows (cutoff ${cutoff}).`
  );

  const existingPrices = await fetchAllExistingPrices(marketCodes, cutoff);
  const existingSet = new Set(
    existingPrices.map((r) => `${r.market_code}__${isoDate(r.price_date)}`)
  );

  const pairCodes = fxIndexPairRows.map((p) => p.pair_code);
  const existingFxIndexPrices = await fetchAllExistingFxIndexPrices(
    pairCodes,
    cutoff
  );
  const existingFxIndexSet = new Set(
    existingFxIndexPrices.map((r) => `${r.pair_code}__${isoDate(r.price_date)}`)
  );

  const mapByCode = new Map<string, PriceMapRow>(
    mapRows.map((m) => [m.market_code, m])
  );

  const marketPriceRowsToInsert: InsertRow[] = [];
  const fxIndexRowsToInsert: FxIndexInsertRow[] = [];

  const neededFxDates = new Set<string>();

  let currentMarket: string | null = null;
  let fetchedReportForCurrentMarket = 0;
  let fetchedReleaseForCurrentMarket = 0;
  let skippedReportForCurrentMarket = 0;
  let skippedReleaseForCurrentMarket = 0;

  for (const row of dateRows) {
    if (currentMarket !== row.market_code) {
      if (currentMarket !== null) {
        console.log(
          `[price-sync] Finished ${currentMarket}: fetched report=${fetchedReportForCurrentMarket}, fetched release=${fetchedReleaseForCurrentMarket}, skipped report=${skippedReportForCurrentMarket}, skipped release=${skippedReleaseForCurrentMarket}`
        );
      }

      currentMarket = row.market_code;
      fetchedReportForCurrentMarket = 0;
      fetchedReleaseForCurrentMarket = 0;
      skippedReportForCurrentMarket = 0;
      skippedReleaseForCurrentMarket = 0;

      const mapping = mapByCode.get(row.market_code);
      console.log(
        `[price-sync] Starting ${row.market_code} (${mapping?.symbol ?? "NO_SYMBOL"})...`
      );
    }

    const mapping = mapByCode.get(row.market_code);
    if (!mapping) continue;

    const reportDate = isoDate(row.report_date);
    const releaseDate = getReleaseDate(reportDate);

    neededFxDates.add(reportDate);
    neededFxDates.add(releaseDate);

    const reportKey = `${row.market_code}__${reportDate}`;
    const releaseKey = `${row.market_code}__${releaseDate}`;

    const updatedAt = new Date().toISOString();

    if (existingSet.has(reportKey)) {
      skippedReportForCurrentMarket += 1;
    } else {
      const rawReportClose = await yahooCloseOn(mapping.symbol, reportDate);
      const reportClose = applyPriceRules(rawReportClose, mapping);

      marketPriceRowsToInsert.push({
        market_code: row.market_code,
        price_date: reportDate,
        close: reportClose,
        source: "yahoo",
        updated_at: updatedAt,
      });

      existingSet.add(reportKey);
      fetchedReportForCurrentMarket += 1;

      console.log(
        `[price-sync] Fetched REPORT ${row.market_code} ${reportDate} ${mapping.symbol} -> ${reportClose ?? "null"}`
      );
    }

    if (existingSet.has(releaseKey)) {
      skippedReleaseForCurrentMarket += 1;
    } else {
      const rawReleaseClose = await yahooCloseOn(mapping.symbol, releaseDate);
      const releaseClose = applyPriceRules(rawReleaseClose, mapping);

      marketPriceRowsToInsert.push({
        market_code: row.market_code,
        price_date: releaseDate,
        close: releaseClose,
        source: "yahoo_release",
        updated_at: updatedAt,
      });

      existingSet.add(releaseKey);
      fetchedReleaseForCurrentMarket += 1;

      console.log(
        `[price-sync] Fetched RELEASE ${row.market_code} ${releaseDate} ${mapping.symbol} -> ${releaseClose ?? "null"}`
      );
    }
  }

  if (currentMarket !== null) {
    console.log(
      `[price-sync] Finished ${currentMarket}: fetched report=${fetchedReportForCurrentMarket}, fetched release=${fetchedReleaseForCurrentMarket}, skipped report=${skippedReportForCurrentMarket}, skipped release=${skippedReleaseForCurrentMarket}`
    );
  }

  const fxDatesSorted = [...neededFxDates].sort();

  console.log(
    `[price-sync] Need FX helper prices for ${fxDatesSorted.length} unique dates across ${fxIndexPairRows.length} pairs.`
  );

  for (const pair of fxIndexPairRows) {
    let fetchedForPair = 0;
    let skippedForPair = 0;

    console.log(
      `[price-sync] Starting FX helper ${pair.pair_code} (${pair.yahoo_symbol})...`
    );

    for (const priceDate of fxDatesSorted) {
      const key = `${pair.pair_code}__${priceDate}`;
      if (existingFxIndexSet.has(key)) {
        skippedForPair += 1;
        continue;
      }

      const close = await yahooCloseOn(pair.yahoo_symbol, priceDate);

      fxIndexRowsToInsert.push({
        pair_code: pair.pair_code,
        price_date: priceDate,
        close,
        source: "yahoo",
        updated_at: new Date().toISOString(),
      });

      existingFxIndexSet.add(key);
      fetchedForPair += 1;

      console.log(
        `[price-sync] Fetched FX HELPER ${pair.pair_code} ${priceDate} ${pair.yahoo_symbol} -> ${close ?? "null"}`
      );
    }

    console.log(
      `[price-sync] Finished FX helper ${pair.pair_code}: fetched=${fetchedForPair}, skipped=${skippedForPair}`
    );
  }

  const chunkSize = 250;

  if (marketPriceRowsToInsert.length) {
    let inserted = 0;

    for (let i = 0; i < marketPriceRowsToInsert.length; i += chunkSize) {
      const chunk = marketPriceRowsToInsert.slice(i, i + chunkSize);

      const { error: upsertError } = await supabase
        .from("cot_market_prices_daily")
        .upsert(chunk, {
          onConflict: "market_code,price_date",
        });

      if (upsertError) {
        throw new Error(
          `Failed to upsert market prices: ${upsertError.message}`
        );
      }

      inserted += chunk.length;
      console.log(
        `[price-sync] Upserted ${inserted}/${marketPriceRowsToInsert.length} rows into cot_market_prices_daily`
      );
    }
  } else {
    console.log("[price-sync] No new rows for cot_market_prices_daily");
  }

  if (fxIndexRowsToInsert.length) {
    let insertedFx = 0;

    for (let i = 0; i < fxIndexRowsToInsert.length; i += chunkSize) {
      const chunk = fxIndexRowsToInsert.slice(i, i + chunkSize);

      const { error: upsertError } = await supabase
        .from("cot_fx_index_prices_daily")
        .upsert(chunk, {
          onConflict: "pair_code,price_date",
        });

      if (upsertError) {
        throw new Error(
          `Failed to upsert FX index prices: ${upsertError.message}`
        );
      }

      insertedFx += chunk.length;
      console.log(
        `[price-sync] Upserted ${insertedFx}/${fxIndexRowsToInsert.length} rows into cot_fx_index_prices_daily`
      );
    }
  } else {
    console.log("[price-sync] No new rows for cot_fx_index_prices_daily");
  }

  console.log(
    `[price-sync] Done. Upserted ${marketPriceRowsToInsert.length} market prices and ${fxIndexRowsToInsert.length} FX helper prices.`
  );

  return {
    ok: true,
    marketPricesInserted: marketPriceRowsToInsert.length,
    fxHelperPricesInserted: fxIndexRowsToInsert.length,
    cutoff,
  };
}