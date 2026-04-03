import { syncCotReports } from "@/lib/cot/pipeline/sync";
import { syncCotMarketPrices } from "@/lib/cot/pipeline/sync-market-prices";
import { rebuildCotServing } from "@/lib/cot/pipeline/rebuild-serving";

type RunScheduledCotSyncOptions = {
  force?: boolean;
  source?: string;
};

type StepResult = {
  name: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export type RunScheduledCotSyncResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  source: string;
  ranAt: string;
  utcWeekday: number;
  utcWeekdayName: string;
  steps: StepResult[];
};

const ALLOWED_UTC_WEEKDAYS = new Set([1, 2, 5]); // Mon, Tue, Fri

function weekdayName(day: number): string {
  switch (day) {
    case 0:
      return "Sunday";
    case 1:
      return "Monday";
    case 2:
      return "Tuesday";
    case 3:
      return "Wednesday";
    case 4:
      return "Thursday";
    case 5:
      return "Friday";
    case 6:
      return "Saturday";
    default:
      return `Unknown(${day})`;
  }
}

async function runStep(name: string, fn: () => Promise<unknown>): Promise<StepResult> {
  try {
    const result = await fn();
    return { name, ok: true, result };
  } catch (error) {
    return {
      name,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function runScheduledCotSync(
  options: RunScheduledCotSyncOptions = {}
): Promise<RunScheduledCotSyncResult> {
  const force = options.force === true;
  const source = options.source ?? "scheduled";
  const now = new Date();
  const utcWeekday = now.getUTCDay();
  const utcWeekdayName = weekdayName(utcWeekday);

  if (!force && !ALLOWED_UTC_WEEKDAYS.has(utcWeekday)) {
    return {
      ok: true,
      skipped: true,
      reason: `No run scheduled for ${utcWeekdayName} (UTC). Allowed days are Monday, Tuesday, Friday.`,
      source,
      ranAt: now.toISOString(),
      utcWeekday,
      utcWeekdayName,
      steps: [],
    };
  }

  const steps: StepResult[] = [];

  steps.push(
    await runStep("sync-cot-reports", async () => {
      return await syncCotReports(source);
    })
  );

  steps.push(
    await runStep("sync-cot-market-prices", async () => {
      return await syncCotMarketPrices();
    })
  );

  steps.push(
    await runStep("rebuild-cot-serving", async () => {
      return await rebuildCotServing(null);
    })
  );

  const ok = steps.every((s) => s.ok);

  return {
    ok,
    skipped: false,
    source,
    ranAt: new Date().toISOString(),
    utcWeekday,
    utcWeekdayName,
    steps,
  };
}