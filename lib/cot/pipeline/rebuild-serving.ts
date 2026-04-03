import { createClient } from "@supabase/supabase-js";

export type RebuildCotServingResult = {
  ok: boolean;
  market_code: string | null;
  history_rows: number;
  snapshot_rows: number;
  rebuilt_at: string;
};

function getSupabaseAdminClient() {
  const url =
    process.env.DATA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.DATA_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing DATA_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceKey) {
    throw new Error(
      "Missing DATA_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
}

export async function rebuildCotServing(
  marketCode?: string | null
): Promise<RebuildCotServingResult> {
  const supabaseAdmin = getSupabaseAdminClient();

  const normalizedMarketCode = marketCode?.trim()
    ? marketCode.trim().toUpperCase()
    : null;

  const { data, error } = await supabaseAdmin.rpc("rebuild_cot_serving", {
    p_market_code: normalizedMarketCode,
  });

  if (error) {
    throw new Error(`RPC rebuild_cot_serving failed: ${error.message}`);
  }

  return data as RebuildCotServingResult;
}