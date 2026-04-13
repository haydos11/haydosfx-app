import { yahooIntradaySeries } from "@/lib/pricing/yahoo";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  MARKET_SENTIMENT_ASSETS,
  MARKET_SENTIMENT_INTERVAL,
  MARKET_SENTIMENT_RETENTION_DAYS,
} from "./config";
import { buildPriceRows, buildSnapshotRows } from "./score";
import type { IntradayPriceRow, IntradaySnapshotRow } from "./types";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type FetchBarsResult = {
  symbol: string | null;
  bars: Array<{ ts: string; price: number }>;
};

const ALLOWED_RANGES = new Set([
  "1d",
  "2d",
  "5d",
  "7d",
  "14d",
]);

function normalizeRange(input?: string): string {
  if (!input) return "2d";
  return ALLOWED_RANGES.has(input) ? input : "2d";
}

function retentionCutoffIso(): string {
  return new Date(
    Date.now() - MARKET_SENTIMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

function dedupePriceRows(rows: IntradayPriceRow[]): IntradayPriceRow[] {
  const map = new Map<string, IntradayPriceRow>();

  for (const row of rows) {
    map.set(`${row.ts}__${row.asset_code}`, row);
  }

  return Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
}

function dedupeSnapshotRows(rows: IntradaySnapshotRow[]): IntradaySnapshotRow[] {
  const map = new Map<string, IntradaySnapshotRow>();

  for (const row of rows) {
    map.set(row.ts, row);
  }

  return Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
}

function filterRowsWithinRetention<T extends { ts: string }>(rows: T[], cutoff: string): T[] {
  return rows.filter((row) => row.ts >= cutoff);
}

async function fetchBarsForAsset(symbols: string[], range: string): Promise<FetchBarsResult> {
  for (const symbol of symbols) {
    try {
      const bars = await yahooIntradaySeries(symbol, range, MARKET_SENTIMENT_INTERVAL);

      if (bars.length) {
        return {
          symbol,
          bars: bars.map((b) => ({
            ts: b.ts,
            price: b.close,
          })),
        };
      }
    } catch (error) {
      console.warn(`[market-sentiment] failed symbol ${symbol}`, error);
    }
  }

  return {
    symbol: null,
    bars: [],
  };
}

async function upsertPriceRows(supabase: SupabaseAdmin, rows: IntradayPriceRow[]) {
  if (!rows.length) return;

  const { error } = await supabase
    .from("market_sentiment_intraday_prices")
    .upsert(rows, { onConflict: "ts,asset_code" });

  if (error) {
    throw new Error(`Failed upserting price rows: ${error.message}`);
  }
}

async function upsertSnapshotRows(supabase: SupabaseAdmin, rows: IntradaySnapshotRow[]) {
  if (!rows.length) return;

  const { error } = await supabase
    .from("market_sentiment_intraday_snapshots")
    .upsert(rows, { onConflict: "ts" });

  if (error) {
    throw new Error(`Failed upserting snapshot rows: ${error.message}`);
  }
}

async function pruneOldRows(supabase: SupabaseAdmin, cutoff: string) {
  const { error: priceError } = await supabase
    .from("market_sentiment_intraday_prices")
    .delete()
    .lt("ts", cutoff);

  if (priceError) {
    throw new Error(`Failed pruning price rows: ${priceError.message}`);
  }

  const { error: snapshotError } = await supabase
    .from("market_sentiment_intraday_snapshots")
    .delete()
    .lt("ts", cutoff);

  if (snapshotError) {
    throw new Error(`Failed pruning snapshot rows: ${snapshotError.message}`);
  }
}

export async function syncMarketSentimentIntraday(inputRange?: string) {
  const range = normalizeRange(inputRange);
  const supabase = getSupabaseAdmin();
  const cutoff = retentionCutoffIso();

  const priceRowsByAsset: Record<string, IntradayPriceRow[]> = {};

  let insertedAssets = 0;
  let failedAssets = 0;
  const failures: Array<{ asset: string; reason: string }> = [];

  for (const asset of MARKET_SENTIMENT_ASSETS) {
    try {
      const fetched = await fetchBarsForAsset(asset.symbols, range);

      if (!fetched.bars.length) {
        failedAssets += 1;
        failures.push({
          asset: asset.code,
          reason: "No bars returned from Yahoo",
        });
        console.warn(`[market-sentiment] no bars for ${asset.code}`);
        continue;
      }

      const rawRows = buildPriceRows(
        asset.code,
        asset.name,
        asset.assetClass,
        fetched.bars
      );

      const rows = filterRowsWithinRetention(dedupePriceRows(rawRows), cutoff);

      if (!rows.length) {
        failedAssets += 1;
        failures.push({
          asset: asset.code,
          reason: "No rows remained after retention filter",
        });
        console.warn(`[market-sentiment] no retained rows for ${asset.code}`);
        continue;
      }

      priceRowsByAsset[asset.code] = rows;
      await upsertPriceRows(supabase, rows);

      insertedAssets += 1;

      console.log(
        `[market-sentiment] synced ${asset.code} symbol=${fetched.symbol} rows=${rows.length}`
      );
    } catch (error) {
      failedAssets += 1;

      const message =
        error instanceof Error ? error.message : "Unexpected asset sync error";

      failures.push({
        asset: asset.code,
        reason: message,
      });

      console.error(`[market-sentiment] asset sync failed for ${asset.code}`, error);
    }
  }

  const rawSnapshots = buildSnapshotRows(priceRowsByAsset);
  const snapshots = filterRowsWithinRetention(dedupeSnapshotRows(rawSnapshots), cutoff);

  await upsertSnapshotRows(supabase, snapshots);
  await pruneOldRows(supabase, cutoff);

  const latestSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;

  return {
    ok: true,
    range,
    cutoff,
    insertedAssets,
    failedAssets,
    priceRows: Object.values(priceRowsByAsset).reduce((acc, rows) => acc + rows.length, 0),
    snapshotRows: snapshots.length,
    latestSnapshotTs: latestSnapshot?.ts ?? null,
    failures,
  };
}