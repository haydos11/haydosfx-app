import { MARKET_SENTIMENT_ASSETS } from "./config";
import type {
  IntradayPriceRow,
  IntradaySnapshotRow,
  SnapshotComponent,
} from "./types";

function pctChange(current: number, base: number | null | undefined): number | null {
  if (base == null || base === 0) return null;
  return ((current - base) / base) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nearestAtOrBefore(
  rows: Array<{ ts: string; price: number }>,
  targetMs: number
): number | null {
  let best: number | null = null;

  for (const row of rows) {
    const ms = Date.parse(row.ts);
    if (Number.isNaN(ms)) continue;
    if (ms <= targetMs) best = row.price;
    else break;
  }

  return best;
}

function latestRowAtOrBefore<T extends { ts: string }>(
  rows: T[],
  targetMs: number
): T | null {
  let best: T | null = null;

  for (const row of rows) {
    const ms = Date.parse(row.ts);
    if (Number.isNaN(ms)) continue;
    if (ms <= targetMs) best = row;
    else break;
  }

  return best;
}

function londonAnchor(tsIso: string): number {
  const d = new Date(tsIso);
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    8,
    0,
    0
  );
}

function sessionAnchor(tsIso: string): number {
  const d = new Date(tsIso);
  const hour = d.getUTCHours();

  let anchorHour = 0;
  let anchorMinute = 0;

  if (hour >= 13) {
    anchorHour = 13;
    anchorMinute = 30;
  } else if (hour >= 8) {
    anchorHour = 8;
    anchorMinute = 0;
  }

  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    anchorHour,
    anchorMinute,
    0
  );
}

function previousDaySameTime(tsIso: string): number {
  return Date.parse(tsIso) - 24 * 60 * 60 * 1000;
}

function classifyRegime(score: number): string {
  if (score >= 5) return "strong_risk_on";
  if (score >= 2) return "mild_risk_on";
  if (score <= -5) return "strong_risk_off";
  if (score <= -2) return "mild_risk_off";
  return "mixed";
}

function describeRegime(regime: string): string {
  switch (regime) {
    case "strong_risk_on":
      return "Strong risk appetite";
    case "mild_risk_on":
      return "Mild risk-on tone";
    case "strong_risk_off":
      return "Strong defensive tone";
    case "mild_risk_off":
      return "Mild risk-off tone";
    default:
      return "Mixed sentiment";
  }
}

function fmtSigned(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "unavailable";
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

function topDrivers(components: Record<string, SnapshotComponent>) {
  return Object.entries(components)
    .sort((a, b) => Math.abs(b[1].score) - Math.abs(a[1].score))
    .slice(0, 4)
    .map(([code, comp]) => ({
      code,
      direction: comp.direction,
      score: comp.score,
    }));
}

function driverText(drivers: Array<{ code: string; direction: string }>): string {
  if (!drivers.length) return "";

  return drivers
    .map((d) => {
      if (d.direction === "risk_on") return `${d.code} supporting risk`;
      if (d.direction === "risk_off") return `${d.code} leaning defensive`;
      return `${d.code} neutral`;
    })
    .join(", ");
}

function buildSummaryText(args: {
  regime: string;
  improving: boolean;
  degrading: boolean;
  previousScoreChange: number | null;
  londonChangeScore: number | null;
  previousDaySameTimeScoreChange: number | null;
  rolling2hScoreChange: number | null;
  rolling4hScoreChange: number | null;
  drivers: Array<{ code: string; direction: string }>;
}): string {
  const {
    regime,
    improving,
    degrading,
    previousScoreChange,
    londonChangeScore,
    previousDaySameTimeScoreChange,
    rolling2hScoreChange,
    rolling4hScoreChange,
    drivers,
  } = args;

  const state = improving ? "improving" : degrading ? "degrading" : "holding steady";

  const parts = [
    `${describeRegime(regime)}, currently ${state}.`,
    `Vs previous snapshot: ${fmtSigned(previousScoreChange)}.`,
    `Since London open: ${fmtSigned(londonChangeScore)}.`,
    `Vs same time yesterday: ${fmtSigned(previousDaySameTimeScoreChange)}.`,
    `2h drift: ${fmtSigned(rolling2hScoreChange)}.`,
    `4h drift: ${fmtSigned(rolling4hScoreChange)}.`,
  ];

  const driversLine = driverText(drivers);
  if (driversLine) {
    parts.push(`Main drivers: ${driversLine}.`);
  }

  return parts.join(" ");
}

function normalizeMove(value: number | null | undefined, divisor: number) {
  if (value == null || Number.isNaN(value)) return 0;
  return clamp(value / divisor, -1, 1);
}

function blendedSignedSignal(row: IntradayPriceRow, polarity: -1 | 0 | 1) {
  if (polarity === 0) return 0;

  const latest = normalizeMove(row.prev_15m_change_pct, 0.30);
  const hour = normalizeMove(row.hour_change_pct, 0.60);
  const london = normalizeMove(row.london_change_pct, 1.00);
  const session = normalizeMove(row.session_change_pct, 0.90);
  const day = normalizeMove(row.day_change_pct, 1.40);

  const blended =
    latest * 0.12 +
    hour * 0.22 +
    session * 0.24 +
    london * 0.18 +
    day * 0.24;

  return blended * polarity;
}

export function buildPriceRows(
  assetCode: string,
  assetName: string,
  assetClass: IntradayPriceRow["asset_class"],
  bars: Array<{ ts: string; price: number }>
): IntradayPriceRow[] {
  return bars.map((bar, index) => {
    const currentMs = Date.parse(bar.ts);
    const dt = new Date(bar.ts);

    const prev15 = index > 0 ? bars[index - 1]?.price ?? null : null;
    const hourAgo = nearestAtOrBefore(bars, currentMs - 60 * 60 * 1000);
    const twoHoursAgo = nearestAtOrBefore(bars, currentMs - 2 * 60 * 60 * 1000);
    const fourHoursAgo = nearestAtOrBefore(bars, currentMs - 4 * 60 * 60 * 1000);
    const prevDaySameTime = nearestAtOrBefore(bars, previousDaySameTime(bar.ts));

    const dayStart = nearestAtOrBefore(
      bars,
      Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0)
    );

    const londonStart = nearestAtOrBefore(bars, londonAnchor(bar.ts));
    const sessionStart = nearestAtOrBefore(bars, sessionAnchor(bar.ts));

    return {
      ts: bar.ts,
      asset_code: assetCode,
      asset_name: assetName,
      asset_class: assetClass,
      source: "yahoo",
      price: bar.price,
      prev_15m_change_pct: pctChange(bar.price, prev15),
      hour_change_pct: pctChange(bar.price, hourAgo),
      rolling_2h_change_pct: pctChange(bar.price, twoHoursAgo),
      rolling_4h_change_pct: pctChange(bar.price, fourHoursAgo),
      previous_day_same_time_change_pct: pctChange(bar.price, prevDaySameTime),
      day_change_pct: pctChange(bar.price, dayStart),
      london_change_pct: pctChange(bar.price, londonStart),
      session_change_pct: pctChange(bar.price, sessionStart),
    };
  });
}

function scoreLookupAtOrBefore(
  snapshotIndex: Array<{ ts: string; score: number }>,
  targetMs: number
): number | null {
  let best: number | null = null;

  for (const row of snapshotIndex) {
    const ms = Date.parse(row.ts);
    if (Number.isNaN(ms)) continue;
    if (ms <= targetMs) best = row.score;
    else break;
  }

  return best;
}

export function buildSnapshotRows(
  priceRowsByAsset: Record<string, IntradayPriceRow[]>
): IntradaySnapshotRow[] {
  const timestampSet = new Set<string>();

  for (const rows of Object.values(priceRowsByAsset)) {
    for (const row of rows) {
      timestampSet.add(row.ts);
    }
  }

  const timestamps = Array.from(timestampSet).sort();

  const sortedRowsByAsset: Record<string, IntradayPriceRow[]> = {};
  for (const asset of MARKET_SENTIMENT_ASSETS) {
    sortedRowsByAsset[asset.code] = [...(priceRowsByAsset[asset.code] ?? [])].sort((a, b) =>
      a.ts.localeCompare(b.ts)
    );
  }

  const snapshots: IntradaySnapshotRow[] = [];

  for (const ts of timestamps) {
    const currentMs = Date.parse(ts);

    let score = 0;
    let breadthAligned = 0;
    let breadthTotal = 0;

    const components: Record<string, SnapshotComponent> = {};

    for (const asset of MARKET_SENTIMENT_ASSETS) {
      const row = latestRowAtOrBefore(sortedRowsByAsset[asset.code] ?? [], currentMs);
      if (!row) continue;

      let componentScore = 0;
      let direction: SnapshotComponent["direction"] = "neutral";

      if (asset.polarity === 0) {
        componentScore = 0;
        direction = "neutral";
      } else {
        const signedSignal = blendedSignedSignal(row, asset.polarity);
        componentScore = signedSignal * asset.weight;

        if (componentScore > 0.12) {
          direction = "risk_on";
        } else if (componentScore < -0.12) {
          direction = "risk_off";
        } else {
          direction = "neutral";
        }

        breadthTotal += 1;
        if (direction !== "neutral") {
          breadthAligned += 1;
        }
      }

      score += componentScore;

      components[asset.code] = {
        score: componentScore,
        latestChange: row.prev_15m_change_pct,
        hourChange: row.hour_change_pct,
        rolling2hChange: row.rolling_2h_change_pct,
        rolling4hChange: row.rolling_4h_change_pct,
        previousDaySameTimeChange: row.previous_day_same_time_change_pct,
        londonChange: row.london_change_pct,
        sessionChange: row.session_change_pct,
        direction,
      };
    }

    const prevSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;
    const previousScoreChange = prevSnapshot ? score - prevSnapshot.score : null;

    const snapshotIndex = snapshots.map((s) => ({ ts: s.ts, score: s.score }));

    const londonReferenceScore = scoreLookupAtOrBefore(snapshotIndex, londonAnchor(ts));
    const sessionReferenceScore = scoreLookupAtOrBefore(snapshotIndex, sessionAnchor(ts));
    const previousDaySameTimeReferenceScore = scoreLookupAtOrBefore(
      snapshotIndex,
      currentMs - 24 * 60 * 60 * 1000
    );
    const rolling2hReferenceScore = scoreLookupAtOrBefore(
      snapshotIndex,
      currentMs - 2 * 60 * 60 * 1000
    );
    const rolling4hReferenceScore = scoreLookupAtOrBefore(
      snapshotIndex,
      currentMs - 4 * 60 * 60 * 1000
    );

    const londonChangeScore =
      londonReferenceScore != null ? score - londonReferenceScore : null;

    const sessionChangeScore =
      sessionReferenceScore != null ? score - sessionReferenceScore : null;

    const previousDaySameTimeScoreChange =
      previousDaySameTimeReferenceScore != null
        ? score - previousDaySameTimeReferenceScore
        : null;

    const rolling2hScoreChange =
      rolling2hReferenceScore != null ? score - rolling2hReferenceScore : null;

    const rolling4hScoreChange =
      rolling4hReferenceScore != null ? score - rolling4hReferenceScore : null;

    const improving = previousScoreChange != null ? previousScoreChange > 0 : false;
    const degrading = previousScoreChange != null ? previousScoreChange < 0 : false;
    const breadth = breadthTotal > 0 ? breadthAligned / breadthTotal : 0;
    const confidence = Math.min(1, Math.abs(score) / 6);

    const regime = classifyRegime(score);
    const drivers = topDrivers(components);

    snapshots.push({
      ts,
      regime,
      score,
      breadth,
      improving,
      degrading,
      confidence,
      previous_score_change: previousScoreChange,
      london_change_score: londonChangeScore,
      session_change_score: sessionChangeScore,
      previous_day_same_time_score_change: previousDaySameTimeScoreChange,
      rolling_2h_score_change: rolling2hScoreChange,
      rolling_4h_score_change: rolling4hScoreChange,
      summary_text: buildSummaryText({
        regime,
        improving,
        degrading,
        previousScoreChange,
        londonChangeScore,
        previousDaySameTimeScoreChange,
        rolling2hScoreChange,
        rolling4hScoreChange,
        drivers,
      }),
      components,
    });
  }

  return snapshots;
}