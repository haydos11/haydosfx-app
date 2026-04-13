import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  MarketContextGroupedRow,
  MarketContextPriceRow,
} from "./types";

type GetMarketContextPricesParams = {
  dateFrom: string;
  dateTo: string;
  assetClasses?: string[];
  assetCodes?: string[];
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function getMarketContextPrices({
  dateFrom,
  dateTo,
  assetClasses = [],
  assetCodes = [],
}: GetMarketContextPricesParams): Promise<MarketContextPriceRow[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("market_context_prices_daily")
    .select(
      "asset_code, asset_class, yahoo_symbol, price_date, close, source, updated_at"
    )
    .gte("price_date", dateFrom)
    .lte("price_date", dateTo)
    .order("asset_code", { ascending: true })
    .order("price_date", { ascending: true });

  if (assetClasses.length > 0) {
    query = query.in("asset_class", assetClasses);
  }

  if (assetCodes.length > 0) {
    query = query.in("asset_code", assetCodes);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load market context prices: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    asset_code: String(row.asset_code),
    asset_class: String(row.asset_class),
    yahoo_symbol: String(row.yahoo_symbol ?? ""),
    price_date: String(row.price_date).slice(0, 10),
    close: toNumber(row.close),
    source: row.source ? String(row.source) : null,
    updated_at: String(row.updated_at),
  }));
}

export function groupMarketContextPrices(
  rows: MarketContextPriceRow[]
): MarketContextGroupedRow[] {
  const byAsset = new Map<string, MarketContextPriceRow[]>();

  for (const row of rows) {
    const key = row.asset_code;
    const bucket = byAsset.get(key) ?? [];
    bucket.push(row);
    byAsset.set(key, bucket);
  }

  const grouped: MarketContextGroupedRow[] = [];

  for (const [assetCode, assetRows] of byAsset.entries()) {
    const sorted = [...assetRows].sort((a, b) =>
      a.price_date.localeCompare(b.price_date)
    );

    const latest = sorted[sorted.length - 1] ?? null;
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

    const latestClose = latest?.close ?? null;
    const previousClose = previous?.close ?? null;

    const absoluteChange =
      latestClose != null && previousClose != null
        ? latestClose - previousClose
        : null;

    const percentChange =
      latestClose != null &&
      previousClose != null &&
      previousClose !== 0
        ? ((latestClose - previousClose) / previousClose) * 100
        : null;

    if (!latest) continue;

    grouped.push({
      asset_code: assetCode,
      asset_class: latest.asset_class,
      yahoo_symbol: latest.yahoo_symbol,
      latest_date: latest.price_date,
      latest_close: latestClose,
      previous_date: previous?.price_date ?? null,
      previous_close: previousClose,
      absolute_change: absoluteChange,
      percent_change: percentChange,
    });
  }

  return grouped.sort((a, b) => {
    if (a.asset_class !== b.asset_class) {
      return a.asset_class.localeCompare(b.asset_class);
    }
    return a.asset_code.localeCompare(b.asset_code);
  });
}