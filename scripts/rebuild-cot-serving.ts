import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { rebuildCotServing } from "@/lib/cot/pipeline/rebuild-serving";

async function main() {
  const rawArg = process.argv[2]?.trim();
  const marketCode = rawArg ? rawArg.toUpperCase() : null;

  console.log(
    `[rebuild-cot-serving] starting rebuild for ${marketCode ?? "ALL MARKETS"}`
  );

  const result = await rebuildCotServing(marketCode);

  console.log("[rebuild-cot-serving] done:", result);
}

main().catch((err) => {
  console.error("[rebuild-cot-serving] fatal:", err);
  process.exit(1);
});