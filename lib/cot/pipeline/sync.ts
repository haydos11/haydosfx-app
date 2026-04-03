import { MARKETS } from "../markets";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchRawCotData } from "./fetch";
import { transformCotRows } from "./transform";
import type { CotMarketMeta } from "./types";

type SyncResult = {
  rowsFetched: number;
  rowsTransformed: number;
  rowsUpserted: number;
  latestReportDateSeen: string | null;
  fetchStartDate: string | null;
};

const EXTRA_SOCRATA_FETCH_KEYS = [
  "NZ DOLLAR - CHICAGO MERCANTILE EXCHANGE",
  "BRITISH POUND - CHICAGO MERCANTILE EXCHANGE",
];

// Temporary focused repair mode for broken markets.
// Set to null to run everything again later.
const ONLY_FETCH_KEYS: string[] | null = null;

const UPSERT_CHUNK_SIZE = 500;

// For cron runs, re-fetch a small overlap window in case of late reports / revisions.
const CRON_OVERLAP_DAYS = 21;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function addUtcDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isCronSource(source: string): boolean {
  return /cron/i.test(source);
}

async function getLatestKnownReportDate(): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cot_reports")
    .select("report_date")
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest cot_reports date: ${error.message}`);
  }

  return data?.report_date ? String(data.report_date).slice(0, 10) : null;
}

async function resolveFetchStartDate(source: string): Promise<string | null> {
  if (!isCronSource(source)) {
    return null;
  }

  const latestKnown = await getLatestKnownReportDate();
  if (!latestKnown) {
    return null;
  }

  return addUtcDays(latestKnown, -CRON_OVERLAP_DAYS);
}

type TransformedRowLike = {
  market_code: string;
  report_date: string;
};

function dedupeTransformedRows<T extends TransformedRowLike>(rows: T[]): T[] {
  const seen = new Map<string, T>();

  for (const row of rows) {
    const key = `${String(row.market_code).toUpperCase()}__${String(
      row.report_date
    ).slice(0, 10)}`;

    // Keep the latest encountered version
    seen.set(key, row);
  }

  return [...seen.values()].sort((a, b) => {
    const aCode = String(a.market_code).toUpperCase();
    const bCode = String(b.market_code).toUpperCase();

    if (aCode < bCode) return -1;
    if (aCode > bCode) return 1;

    return String(a.report_date).localeCompare(String(b.report_date));
  });
}

export async function syncCotReports(source = "manual"): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();

  const { data: runRow, error: runInsertError } = await supabase
    .from("cot_sync_runs")
    .insert({
      source,
      status: "running",
    })
    .select("id")
    .single();

  if (runInsertError || !runRow) {
    throw new Error(
      `Failed to create sync run: ${runInsertError?.message ?? "unknown error"}`
    );
  }

  const runId = runRow.id;

  try {
    const { data: marketMetaRows, error: marketsError } = await supabase
      .from("cot_markets")
      .select("*")
      .eq("is_active", true);

    if (marketsError) {
      throw new Error(`Failed to load cot_markets: ${marketsError.message}`);
    }

    const typedMeta = (marketMetaRows ?? []) as CotMarketMeta[];

    const activeSocrataKeys = new Set(
      typedMeta.map((m) => m.socrata_key).filter((v): v is string => Boolean(v))
    );

    const registrySocrataKeys = MARKETS
      .map((m) => m.cftcName)
      .filter((name) => activeSocrataKeys.has(name));

    const baseFetchKeys = Array.from(
      new Set([...registrySocrataKeys, ...EXTRA_SOCRATA_FETCH_KEYS])
    );

    const fetchKeys = ONLY_FETCH_KEYS
      ? baseFetchKeys.filter((k) => ONLY_FETCH_KEYS.includes(k))
      : baseFetchKeys;

    const fetchStartDate = await resolveFetchStartDate(source);

    const rawRows = await fetchRawCotData(fetchKeys, fetchStartDate);

    const transformedRaw = transformCotRows(rawRows, typedMeta);
    const transformed = dedupeTransformedRows(transformedRaw);

    const latestReportDateSeen =
      transformed.length > 0
        ? transformed.map((r) => r.report_date).sort().at(-1) ?? null
        : null;

    let rowsUpserted = 0;

    if (transformed.length > 0) {
      const chunks = chunkArray(transformed, UPSERT_CHUNK_SIZE);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const { error: upsertError } = await supabase
          .from("cot_reports")
          .upsert(chunk, {
            onConflict: "report_date,market_code",
          });

        if (upsertError) {
          throw new Error(
            `Failed to upsert cot_reports chunk ${i + 1}/${chunks.length}: ${upsertError.message}`
          );
        }

        rowsUpserted += chunk.length;
        console.log(
          `Upserted chunk ${i + 1}/${chunks.length} (${rowsUpserted}/${transformed.length})`
        );
      }
    }

    const { error: runUpdateError } = await supabase
      .from("cot_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_fetched: rawRows.length,
        rows_transformed: transformed.length,
        rows_upserted: rowsUpserted,
        latest_report_date_seen: latestReportDateSeen,
        meta: {
          fetchStartDate,
          fetchKeysCount: fetchKeys.length,
          onlyFetchKeys: ONLY_FETCH_KEYS,
          upsertChunkSize: UPSERT_CHUNK_SIZE,
          cronOverlapDays: CRON_OVERLAP_DAYS,
          rowsTransformedBeforeDedupe: transformedRaw.length,
          rowsTransformedAfterDedupe: transformed.length,
        },
      })
      .eq("id", runId);

    if (runUpdateError) {
      throw new Error(`Failed to update sync run: ${runUpdateError.message}`);
    }

    return {
      rowsFetched: rawRows.length,
      rowsTransformed: transformed.length,
      rowsUpserted,
      latestReportDateSeen,
      fetchStartDate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";

    await supabase
      .from("cot_sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runId);

    throw error;
  }
}