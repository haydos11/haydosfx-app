import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { yahooCloseOn } from "@/lib/pricing/yahoo";

type ContextAssetClass = "yield" | "index" | "vol" | "commodity";

type ContextAsset = {
  asset_code: string;
  asset_class: ContextAssetClass;
  yahoo_symbol: string;
  divisor?: number;
};

type ExistingContextRow = {
  asset_code: string;
  price_date: string;
};

type ContextInsertRow = {
  asset_code: string;
  asset_class: string;
  yahoo_symbol: string;
  price_date: string;
  close: number | null;
  source: string;
  updated_at: string;
};

export type SyncMarketContextPricesResult = {
  ok: boolean;
  inserted: number;
  cutoff: string;
};

const CONTEXT_ASSETS: ContextAsset[] = [
  { asset_code: "US10Y", asset_class: "yield", yahoo_symbol: "^TNX", divisor: 10 },
  { asset_code: "US2Y", asset_class: "yield", yahoo_symbol: "^IRX", divisor: 10 },
  { asset_code: "VIX", asset_class: "vol", yahoo_symbol: "^VIX" },

  { asset_code: "SPX", asset_class: "index", yahoo_symbol: "^GSPC" },
  { asset_code: "NDX", asset_class: "index", yahoo_symbol: "^NDX" },

  { asset_code: "GER40", asset_class: "index", yahoo_symbol: "^GDAXI" },
  { asset_code: "FRA40", asset_class: "index", yahoo_symbol: "^FCHI" },
  { asset_code: "UK100", asset_class: "index", yahoo_symbol: "^FTSE" },
  { asset_code: "JP225", asset_class: "index", yahoo_symbol: "^N225" },
  { asset_code: "AUS200", asset_class: "index", yahoo_symbol: "^AXJO" },
];

function isoDate(input: Date | string): string {
  if (typeof input === "string") return input.slice(0, 10);
  return input.toISOString().slice(0, 10);
}

function addUtcDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cutoffRecent(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function dateRangeInclusive(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    out.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return out;
}

function normalizeClose(raw: number | null, asset: ContextAsset): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;

  let value = raw;

  if (
    asset.divisor != null &&
    Number.isFinite(asset.divisor) &&
    asset.divisor !== 0
  ) {
    value = value / asset.divisor;
  }

  return Number.isFinite(value) ? value : null;
}

async function fetchAllExistingContextPrices(
  assetCodes: string[],
  minDate: string
): Promise<ExistingContextRow[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 2000;
  let from = 0;
  let done = false;
  const allRows: ExistingContextRow[] = [];

  while (!done) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("market_context_prices_daily")
      .select("asset_code, price_date")
      .in("asset_code", assetCodes)
      .gte("price_date", minDate)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load existing context prices: ${error.message}`);
    }

    const rows = (data ?? []) as ExistingContextRow[];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      done = true;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

export async function syncMarketContextPrices(): Promise<SyncMarketContextPricesResult> {
  const supabase = getSupabaseAdmin();

  // Roughly 6 months
  const cutoff = cutoffRecent(185);
  const today = isoDate(new Date());

  console.log(`[context-sync] cutoff=${cutoff} today=${today}`);

  const assetCodes = CONTEXT_ASSETS.map((a) => a.asset_code);
  const existingRows = await fetchAllExistingContextPrices(assetCodes, cutoff);

  const existingSet = new Set(
    existingRows.map((r) => `${r.asset_code}__${String(r.price_date).slice(0, 10)}`)
  );

  const days = dateRangeInclusive(cutoff, today);
  const rowsToInsert: ContextInsertRow[] = [];

  for (const asset of CONTEXT_ASSETS) {
    let fetched = 0;
    let skipped = 0;

    console.log(
      `[context-sync] Starting ${asset.asset_code} (${asset.yahoo_symbol})...`
    );

    for (const priceDate of days) {
      const key = `${asset.asset_code}__${priceDate}`;

      if (existingSet.has(key)) {
        skipped += 1;
        continue;
      }

      const rawClose = await yahooCloseOn(asset.yahoo_symbol, priceDate);
      const close = normalizeClose(rawClose, asset);

      rowsToInsert.push({
        asset_code: asset.asset_code,
        asset_class: asset.asset_class,
        yahoo_symbol: asset.yahoo_symbol,
        price_date: priceDate,
        close,
        source: "yahoo",
        updated_at: new Date().toISOString(),
      });

      existingSet.add(key);
      fetched += 1;

      console.log(
        `[context-sync] Fetched ${asset.asset_code} ${priceDate} ${asset.yahoo_symbol} -> ${close ?? "null"}`
      );
    }

    console.log(
      `[context-sync] Finished ${asset.asset_code}: fetched=${fetched}, skipped=${skipped}`
    );
  }

  const chunkSize = 250;

  if (!rowsToInsert.length) {
    console.log("[context-sync] No new rows to insert.");
    return {
      ok: true,
      inserted: 0,
      cutoff,
    };
  }

  let inserted = 0;

  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    const chunk = rowsToInsert.slice(i, i + chunkSize);

    const { error } = await supabase
      .from("market_context_prices_daily")
      .upsert(chunk, {
        onConflict: "asset_code,price_date",
      });

    if (error) {
      throw new Error(`Failed to upsert market context prices: ${error.message}`);
    }

    inserted += chunk.length;

    console.log(
      `[context-sync] Upserted ${inserted}/${rowsToInsert.length} rows into market_context_prices_daily`
    );
  }

  console.log(`[context-sync] Done. Upserted ${inserted} rows.`);

  return {
    ok: true,
    inserted,
    cutoff,
  };
}