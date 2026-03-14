import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { postCalendarValues } from "../lib/calendar-import/post-values";
import { fetchAbsCpiValues } from "../lib/calendar-import/sources/abs-cpi";

async function runSources() {
  const results = await Promise.all([
    fetchAbsCpiValues(),
    // add more sources here later
  ]);

  return results.flat();
}

async function main() {
  console.log("Running calendar imports...");

  const values = await runSources();

  if (!values.length) {
    console.log("No values returned from sources");
    return;
  }

  console.log(`Prepared ${values.length} values`);

  const result = await postCalendarValues(values);

  console.log("Upsert result:", result);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});