import dotenv from "dotenv";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { yahooCloseOn, inv } from "@/lib/pricing/yahoo";

dotenv.config({ path: ".env.local" });

type PriceMapRow = {
  market_code: string;
  market_name: string | null;
  symbol: string;
  invert_price: boolean;
  price_multiplier: number | null;
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

type InsertRow = {
  market_code: string;
  price_date: string;
  close: number | null;
  source: string;
  updated_at: string;
};

function cutoffDate(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
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
  // COT report date is typically Tuesday; release is typically Friday.
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

  if (mapping.price_multiplier != null && Number.isFinite(mapping.price_multiplier)) {
    close = close * mapping.price_multiplier;
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
      .order("market_code", { ascending: true })
      .order("price_date", { ascending: true })
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

async function main() {
  const supabase = getSupabaseAdmin();

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
    console.log("No active price mappings found.");
    return;
  }

  console.log(
    `Loaded ${mapRows.length} active market mappings: ${mapRows
      .map((m) => `${m.market_code}:${m.symbol}`)
      .join(", ")}`
  );

  const marketCodes = mapRows.map((m) => m.market_code);

  const allDates = await fetchAllCotDates(marketCodes);

  if (!allDates.length) {
    console.log("No COT report dates found for mapped markets.");
    return;
  }

  const cutoff = cutoffDate(10);

  const filteredDates = allDates.filter(
    (r) => isoDate(r.report_date) >= cutoff
  );

  const dateRows = filteredDates.slice().sort(byMarketThenDateAsc);

  console.log(
    `Filtering to last 10 years. Using ${dateRows.length}/${allDates.length} rows (cutoff ${cutoff}).`
  );

  const rowsPerMarket = new Map<string, number>();
  for (const row of dateRows) {
    rowsPerMarket.set(
      row.market_code,
      (rowsPerMarket.get(row.market_code) ?? 0) + 1
    );
  }

  console.log("Rows per market after cutoff:");
  for (const mapRow of mapRows) {
    console.log(
      `  ${mapRow.market_code} (${mapRow.symbol}): ${rowsPerMarket.get(mapRow.market_code) ?? 0}`
    );
  }

  // We now need existing prices for both Tuesday report dates and Friday release dates.
  // Since Friday can extend past cutoff weeks, use the same cutoff here; that is sufficient
  // because all inserted release dates will be >= corresponding report dates in the same range.
  const existingPrices = await fetchAllExistingPrices(marketCodes, cutoff);

  const existingSet = new Set(
    existingPrices.map(
      (r) => `${r.market_code}__${isoDate(r.price_date)}`
    )
  );

  const mapByCode = new Map<string, PriceMapRow>(
    mapRows.map((m) => [m.market_code, m])
  );

  const toInsert: InsertRow[] = [];

  let currentMarket: string | null = null;
  let fetchedReportForCurrentMarket = 0;
  let fetchedReleaseForCurrentMarket = 0;
  let skippedReportForCurrentMarket = 0;
  let skippedReleaseForCurrentMarket = 0;

  for (const row of dateRows) {
    if (currentMarket !== row.market_code) {
      if (currentMarket !== null) {
        console.log(
          `Finished ${currentMarket}: fetched report=${fetchedReportForCurrentMarket}, fetched release=${fetchedReleaseForCurrentMarket}, skipped report=${skippedReportForCurrentMarket}, skipped release=${skippedReleaseForCurrentMarket}`
        );
      }

      currentMarket = row.market_code;
      fetchedReportForCurrentMarket = 0;
      fetchedReleaseForCurrentMarket = 0;
      skippedReportForCurrentMarket = 0;
      skippedReleaseForCurrentMarket = 0;

      const mapping = mapByCode.get(row.market_code);
      console.log(
        `Starting ${row.market_code} (${mapping?.symbol ?? "NO_SYMBOL"})...`
      );
    }

    const mapping = mapByCode.get(row.market_code);
    if (!mapping) continue;

    const reportDate = isoDate(row.report_date);
    const releaseDate = getReleaseDate(reportDate);

    const reportKey = `${row.market_code}__${reportDate}`;
    const releaseKey = `${row.market_code}__${releaseDate}`;

    const updatedAt = new Date().toISOString();

    if (existingSet.has(reportKey)) {
      skippedReportForCurrentMarket += 1;
    } else {
      const rawReportClose = await yahooCloseOn(mapping.symbol, reportDate);
      const reportClose = applyPriceRules(rawReportClose, mapping);

      toInsert.push({
        market_code: row.market_code,
        price_date: reportDate,
        close: reportClose,
        source: "yahoo",
        updated_at: updatedAt,
      });

      existingSet.add(reportKey);
      fetchedReportForCurrentMarket += 1;

      console.log(
        `Fetched REPORT ${row.market_code} ${reportDate} ${mapping.symbol} -> ${reportClose ?? "null"}`
      );
    }

    if (existingSet.has(releaseKey)) {
      skippedReleaseForCurrentMarket += 1;
    } else {
      const rawReleaseClose = await yahooCloseOn(mapping.symbol, releaseDate);
      const releaseClose = applyPriceRules(rawReleaseClose, mapping);

      toInsert.push({
        market_code: row.market_code,
        price_date: releaseDate,
        close: releaseClose,
        source: "yahoo_release",
        updated_at: updatedAt,
      });

      existingSet.add(releaseKey);
      fetchedReleaseForCurrentMarket += 1;

      console.log(
        `Fetched RELEASE ${row.market_code} ${releaseDate} ${mapping.symbol} -> ${releaseClose ?? "null"}`
      );
    }
  }

  if (currentMarket !== null) {
    console.log(
      `Finished ${currentMarket}: fetched report=${fetchedReportForCurrentMarket}, fetched release=${fetchedReleaseForCurrentMarket}, skipped report=${skippedReportForCurrentMarket}, skipped release=${skippedReleaseForCurrentMarket}`
    );
  }

  if (!toInsert.length) {
    console.log("No missing market prices to sync.");
    return;
  }

  const chunkSize = 250;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);

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
    console.log(`Upserted ${inserted}/${toInsert.length}`);
  }

  console.log(`Done. Upserted ${inserted} market prices (report + release dates).`);
}

main().catch((error) => {
  console.error("Price sync failed:", error);
  process.exit(1);
});