import dotenv from "dotenv";
import { syncCotReports } from "../lib/cot/pipeline/sync";

dotenv.config({ path: ".env.local" });

async function main() {
  const result = await syncCotReports("manual-script");
  console.log("COT sync complete:", result);
}

main().catch((error) => {
  console.error("COT sync failed:", error);
  process.exit(1);
});