import { MARKETS } from "../markets";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchRawCotData } from "./fetch";
import { transformCotRows } from "./transform";
import type { CotMarketMeta, CotReportRow } from "./types";

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

// Temporary focused repair mode for the broken markets.
// Set to null to run everything again later.
const ONLY_FETCH_KEYS: string[] | null = null;

const UPSERT_CHUNK_SIZE = 500;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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
      typedMeta
        .map((m) => m.socrata_key)
        .filter((v): v is string => Boolean(v))
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

    const fetchStartDate = null;

    const rawRows = await fetchRawCotData(fetchKeys, fetchStartDate);
    const transformed = transformCotRows(rawRows, typedMeta);

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