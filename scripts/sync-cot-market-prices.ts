import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { syncCotMarketPrices } from "@/lib/cot/pipeline/sync-market-prices";

async function main() {
  const result = await syncCotMarketPrices("recent");
  console.log("Market price sync complete:", result);
}

main().catch((error) => {
  console.error("Price sync failed:", error);
  process.exit(1);
});