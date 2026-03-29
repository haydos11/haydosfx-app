import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type RpcResponse = {
  ok: boolean;
  market_code: string | null;
  history_rows: number;
  snapshot_rows: number;
  rebuilt_at: string;
};

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
    "Missing DATA_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" },
});

async function main() {
  const rawArg = process.argv[2]?.trim();
  const marketCode = rawArg ? rawArg.toUpperCase() : null;

  console.log(
    `[rebuild-cot-serving] starting rebuild for ${
      marketCode ?? "ALL MARKETS"
    }`,
  );

  const { data, error } = await supabaseAdmin.rpc("rebuild_cot_serving", {
    p_market_code: marketCode,
  });

  if (error) {
    console.error("[rebuild-cot-serving] rpc error:", error);
    process.exit(1);
  }

  console.log("[rebuild-cot-serving] done:", data as RpcResponse);
}

main().catch((err) => {
  console.error("[rebuild-cot-serving] fatal:", err);
  process.exit(1);
});