"use client";

import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { supabase } from "@/lib/db/supabase-clients";

type CandleApiRow = {
  symbol: string;
  timeframe: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type BatchCandleApiResponse = {
  ok: boolean;
  candlesByPair?: Record<string, CandleApiRow[]>;
  error?: string;
  cached?: boolean;
};

type Props = {
  limitM5?: number;
  limitH1?: number;
};

const APPLY_MULTIPLIER_FACTOR = true;

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "NZD",
  "CAD",
  "CHF",
  "JPY",
] as const;

type CurrencyCode = (typeof CURRENCIES)[number];
type FocusCurrency = CurrencyCode | "ALL";
type ViewMode = "market" | "index" | "drivers" | "both";
type SourceTf = "M5" | "H1";
type RangeKey = "1D" | "3D" | "1W" | "2W" | "1M" | "3M" | "ALL";
type RebaseMode = "range" | "session";
type SessionAnchor = "asia" | "london" | "newyork";
type SmoothingKey = "off" | "3" | "5" | "8" | "13" | "21" | "34" | "55";
type NewsFilterKey = "off" | "high" | "mediumHigh";
type CalendarMarkersKey = "off" | "day" | "week" | "both";

type DriverSeriesMap = Record<string, number>;

type StrengthPoint = {
  time: string;
  values: Record<CurrencyCode, number>;
  drivers: Record<CurrencyCode, DriverSeriesMap>;
};

type NewsTrend = {
  roc3m: number | null;
  roc6m: number | null;
};

type NewsOverlayEvent = {
  id: string;
  eventId: number;
  time: string;
  timestamp: number;
  currency: CurrencyCode;
  countryCode: string;
  title: string;
  importance: number;
  actual?: string | null;
  previous?: string | null;
  trend?: NewsTrend | null;
};

type NewsMarker = {
  name: string;
  coord: [string, number];
  value: number;
  symbol: string;
  symbolSize: number;
  itemStyle: {
    color: string;
    borderColor: string;
    borderWidth: number;
    shadowBlur: number;
    shadowColor: string;
    opacity?: number;
  };
  label: {
    show: boolean;
    formatter: string;
    color: string;
    fontSize: number;
    fontWeight?: number | string;
  };
  tooltipHtml?: string;
};

type NewsHoverPoint = {
  value: [string, number, number];
  tooltipHtml: string;
  symbolSize: number;
};

type VerticalLine = {
  xAxis: string;
  lineStyle: {
    color: string;
    width: number;
    type: "solid" | "dashed";
    opacity: number;
  };
  label: { show: false };
};

const PAIRS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY",
  "EURGBP",
  "EURAUD",
  "EURNZD",
  "EURCAD",
  "EURCHF",
  "EURJPY",
  "GBPAUD",
  "GBPNZD",
  "GBPCAD",
  "GBPCHF",
  "GBPJPY",
  "AUDNZD",
  "AUDCAD",
  "AUDCHF",
  "AUDJPY",
  "NZDCAD",
  "NZDCHF",
  "NZDJPY",
  "CADCHF",
  "CADJPY",
  "CHFJPY",
] as const;

type PairCode = (typeof PAIRS)[number];

const PAIR_COMPONENTS: Record<PairCode, [CurrencyCode, CurrencyCode]> = {
  EURUSD: ["EUR", "USD"],
  GBPUSD: ["GBP", "USD"],
  AUDUSD: ["AUD", "USD"],
  NZDUSD: ["NZD", "USD"],
  USDCAD: ["USD", "CAD"],
  USDCHF: ["USD", "CHF"],
  USDJPY: ["USD", "JPY"],
  EURGBP: ["EUR", "GBP"],
  EURAUD: ["EUR", "AUD"],
  EURNZD: ["EUR", "NZD"],
  EURCAD: ["EUR", "CAD"],
  EURCHF: ["EUR", "CHF"],
  EURJPY: ["EUR", "JPY"],
  GBPAUD: ["GBP", "AUD"],
  GBPNZD: ["GBP", "NZD"],
  GBPCAD: ["GBP", "CAD"],
  GBPCHF: ["GBP", "CHF"],
  GBPJPY: ["GBP", "JPY"],
  AUDNZD: ["AUD", "NZD"],
  AUDCAD: ["AUD", "CAD"],
  AUDCHF: ["AUD", "CHF"],
  AUDJPY: ["AUD", "JPY"],
  NZDCAD: ["NZD", "CAD"],
  NZDCHF: ["NZD", "CHF"],
  NZDJPY: ["NZD", "JPY"],
  CADCHF: ["CAD", "CHF"],
  CADJPY: ["CAD", "JPY"],
  CHFJPY: ["CHF", "JPY"],
};

const COLORS: Record<CurrencyCode, string> = {
  USD: "#3b82f6",
  EUR: "#22c55e",
  GBP: "#f59e0b",
  AUD: "#ef4444",
  NZD: "#38bdf8",
  CAD: "#14b8a6",
  CHF: "#f97316",
  JPY: "#c084fc",
};

const DRIVER_COLORS = [
  "#60a5fa",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#eab308",
];

const RANGE_CONFIG: Record<
  RangeKey,
  { label: string; tf: SourceTf; bars: number | null }
> = {
  "1D": { label: "1D", tf: "M5", bars: 288 },
  "3D": { label: "3D", tf: "M5", bars: 864 },
  "1W": { label: "1W", tf: "H1", bars: 168 },
  "2W": { label: "2W", tf: "H1", bars: 336 },
  "1M": { label: "1M", tf: "H1", bars: 720 },
  "3M": { label: "3M", tf: "H1", bars: 2160 },
  ALL: { label: "All", tf: "H1", bars: null },
};

const SESSION_LABELS: Record<SessionAnchor, string> = {
  asia: "Asia",
  london: "London",
  newyork: "New York",
};

type UnitRow = { unit: number; symbol: string | null; name: string | null };
type MultiplierRow = { multiplier: number; factor: number; suffix: string | null };

function rebaseSeries(values: number[]): number[] {
  if (!values.length) return [];
  const base = values[0];
  if (!Number.isFinite(base) || base === 0) return values.map(() => 0);
  return values.map((v) => ((v / base) - 1) * 100);
}

async function fetchPairsBatch(timeframe: SourceTf, limit: number) {
  const res = await fetch(
    `/api/market/candles/batch?timeframe=${encodeURIComponent(
      timeframe
    )}&limit=${limit}&symbols=${encodeURIComponent(PAIRS.join(","))}`,
    { cache: "no-store" }
  );

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON batch response: ${text.slice(0, 120)}`);
  }

  const json = (await res.json()) as BatchCandleApiResponse;

  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Failed to load batch candles ${timeframe}`);
  }

  return json.candlesByPair ?? {};
}

function getContributionForCurrency(
  pair: PairCode,
  currency: CurrencyCode,
  pairMove: number
) {
  const [base, quote] = PAIR_COMPONENTS[pair];
  if (currency === base) return pairMove;
  if (currency === quote) return -pairMove;
  return null;
}

function getDriverLabel(pair: PairCode, focusCurrency: CurrencyCode): string | null {
  const [base, quote] = PAIR_COMPONENTS[pair];

  if (focusCurrency === base) {
    return `${base} vs ${quote}`;
  }

  if (focusCurrency === quote) {
    return `${quote} vs ${base}`;
  }

  return null;
}

function buildStrength(rowsByPair: Record<string, CandleApiRow[]>): StrengthPoint[] {
  const availablePairs = PAIRS.filter(
    (pair) => Array.isArray(rowsByPair[pair]) && rowsByPair[pair].length > 0
  );

  if (!availablePairs.length) return [];

  const lengths = availablePairs.map((pair) => rowsByPair[pair].length).filter((n) => n > 0);
  if (!lengths.length) return [];

  const minLen = Math.min(...lengths);
  if (minLen < 2) return [];

  const trimmed: Partial<Record<PairCode, CandleApiRow[]>> = {};
  const pairMoves: Partial<Record<PairCode, number[]>> = {};

  for (const pair of availablePairs) {
    const rows = rowsByPair[pair].slice(-minLen);
    trimmed[pair] = rows;
    pairMoves[pair] = rebaseSeries(rows.map((r) => Number(r.close)));
  }

  const result: StrengthPoint[] = [];

  for (let i = 0; i < minLen; i++) {
    const values = {} as Record<CurrencyCode, number>;
    const drivers = {} as Record<CurrencyCode, DriverSeriesMap>;

    for (const currency of CURRENCIES) {
      const currencyDrivers: DriverSeriesMap = {};

      for (const pair of availablePairs) {
        const moveSeries = pairMoves[pair];
        if (!moveSeries) continue;

        const contribution = getContributionForCurrency(pair, currency, moveSeries[i]);
        if (contribution === null) continue;

        const label = getDriverLabel(pair, currency);
        if (!label) continue;

        currencyDrivers[label] = contribution;
      }

      const driverValues = Object.values(currencyDrivers);
      const avg =
        driverValues.length > 0
          ? driverValues.reduce((sum, v) => sum + v, 0) / driverValues.length
          : 0;

      values[currency] = avg;
      drivers[currency] = currencyDrivers;
    }

    const firstAvailablePair = availablePairs[0];
    const pointTime = trimmed[firstAvailablePair]?.[i]?.time ?? "";

    result.push({
      time: pointTime,
      values,
      drivers,
    });
  }

  return result;
}

async function fetchAndBuildStrength(timeframe: SourceTf, limit: number) {
  const rowsByPair = await fetchPairsBatch(timeframe, limit);
  return buildStrength(rowsByPair);
}

function fmt(v: number | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function getDriverPanelColor(index: number) {
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

function rebasePoints(points: StrengthPoint[]): StrengthPoint[] {
  if (!points.length) return [];

  const base = points[0];

  return points.map((p) => {
    const rebasedValues = {} as Record<CurrencyCode, number>;
    for (const ccy of CURRENCIES) {
      rebasedValues[ccy] = p.values[ccy] - base.values[ccy];
    }

    const rebasedDrivers = {} as Record<CurrencyCode, DriverSeriesMap>;
    for (const ccy of CURRENCIES) {
      rebasedDrivers[ccy] = {};
      const baseDrivers = base.drivers[ccy] ?? {};
      const currentDrivers = p.drivers[ccy] ?? {};

      for (const key of Object.keys(currentDrivers)) {
        rebasedDrivers[ccy][key] = currentDrivers[key] - (baseDrivers[key] ?? 0);
      }
    }

    return {
      time: p.time,
      values: rebasedValues,
      drivers: rebasedDrivers,
    };
  });
}

function getSessionOpenDate(reference: Date, sessionAnchor: SessionAnchor): Date {
  const anchor = new Date(reference);

  if (sessionAnchor === "asia") anchor.setHours(0, 0, 0, 0);
  else if (sessionAnchor === "london") anchor.setHours(8, 0, 0, 0);
  else anchor.setHours(13, 30, 0, 0);

  return anchor;
}

function sliceFromSessionAnchor(
  points: StrengthPoint[],
  sessionAnchor: SessionAnchor
): StrengthPoint[] {
  if (!points.length) return [];

  const latestPointDate = new Date(points[points.length - 1].time);
  const anchorDate = getSessionOpenDate(latestPointDate, sessionAnchor);

  if (latestPointDate.getTime() < anchorDate.getTime()) {
    anchorDate.setDate(anchorDate.getDate() - 1);
  }

  const index = points.findIndex(
    (p) => new Date(p.time).getTime() >= anchorDate.getTime()
  );

  if (index === -1) return points;
  return points.slice(index);
}

function smoothSeries(values: number[], period: number): number[] {
  if (period <= 1 || values.length === 0) return values;

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - period + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
    result.push(avg);
  }
  return result;
}

function smoothPoints(points: StrengthPoint[], smoothing: SmoothingKey): StrengthPoint[] {
  if (!points.length || smoothing === "off") return points;

  const period = Number(smoothing);
  if (!Number.isFinite(period) || period <= 1) return points;

  const valueSeriesByCurrency = {} as Record<CurrencyCode, number[]>;
  for (const ccy of CURRENCIES) {
    valueSeriesByCurrency[ccy] = points.map((p) => p.values[ccy]);
  }

  const smoothedValuesByCurrency = {} as Record<CurrencyCode, number[]>;
  for (const ccy of CURRENCIES) {
    smoothedValuesByCurrency[ccy] = smoothSeries(valueSeriesByCurrency[ccy], period);
  }

  const driverKeysByCurrency = {} as Record<CurrencyCode, string[]>;
  for (const ccy of CURRENCIES) {
    const keySet = new Set<string>();
    for (const p of points) Object.keys(p.drivers[ccy] ?? {}).forEach((k) => keySet.add(k));
    driverKeysByCurrency[ccy] = [...keySet];
  }

  const smoothedDriversByCurrency = {} as Record<CurrencyCode, Record<string, number[]>>;
  for (const ccy of CURRENCIES) {
    smoothedDriversByCurrency[ccy] = {};
    for (const key of driverKeysByCurrency[ccy]) {
      const raw = points.map((p) => p.drivers[ccy]?.[key] ?? 0);
      smoothedDriversByCurrency[ccy][key] = smoothSeries(raw, period);
    }
  }

  return points.map((p, idx) => {
    const values = {} as Record<CurrencyCode, number>;
    const drivers = {} as Record<CurrencyCode, DriverSeriesMap>;

    for (const ccy of CURRENCIES) {
      values[ccy] = smoothedValuesByCurrency[ccy][idx];
      drivers[ccy] = {};
      for (const key of driverKeysByCurrency[ccy]) {
        drivers[ccy][key] = smoothedDriversByCurrency[ccy][key][idx];
      }
    }

    return { time: p.time, values, drivers };
  });
}

function normalizeUtcIso(val: string | number | Date): string {
  if (typeof val === "number") {
    const ms = val < 1e12 ? val * 1000 : val;
    return new Date(ms).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(val)) return new Date(val).toISOString();
    return new Date(val.replace(" ", "T") + "Z").toISOString();
  }
  return new Date().toISOString();
}

function toEpochSeconds(d: string | number | Date): number {
  if (typeof d === "number") {
    const ms = d < 1e12 ? d * 1000 : d;
    return Math.floor(ms / 1000);
  }
  const ms = new Date(d).getTime();
  return Math.floor(ms / 1000);
}

function first<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}

function importanceLabel(importance: number) {
  return importance >= 3 ? "High" : importance >= 2 ? "Moderate" : "Low";
}

function truncateText(text: string, max = 34) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

async function loadUnitMap(): Promise<Map<number, UnitRow>> {
  const r = await supabase.from("calendar_unit_map").select("unit,symbol,name");
  if (r.error) return new Map();
  const map = new Map<number, UnitRow>();
  (r.data ?? []).forEach((row: UnitRow) => map.set(row.unit, row));
  return map;
}

async function loadMultiplierMap(): Promise<Map<number, { factor: number; suffix: string }>> {
  const tryTables = ["calendar_multiplier_map", "calendar_muliplier_map"];
  for (const tbl of tryTables) {
    const r = await supabase.from(tbl).select("multiplier,factor,suffix");
    if (!r.error && r.data) {
      const map = new Map<number, { factor: number; suffix: string }>();
      (r.data as MultiplierRow[]).forEach((row) =>
        map.set(row.multiplier, { factor: Number(row.factor), suffix: row.suffix ?? "" })
      );
      return map;
    }
  }
  return new Map();
}

function fromMql(
  val: number | null | undefined,
  digits?: number | null,
  multiplierFactor?: number | null
): number | null {
  if (val == null) return null;
  const base = val / 1_000_000;
  const scaled = APPLY_MULTIPLIER_FACTOR ? base * (multiplierFactor ?? 1) : base;
  if (digits == null || !Number.isFinite(digits)) return scaled;
  const d = Math.max(0, Number(digits));
  const f = Math.pow(10, d);
  return Math.round(scaled * f) / f;
}

function buildUnitLabel(
  unitId: number | null | undefined,
  multiplierId: number | null | undefined,
  unitMap: Map<number, UnitRow>,
  multMap: Map<number, { factor: number; suffix: string }>,
  countryCurrency?: string | null,
  countrySymbol?: string | null
): string | null {
  if (unitId == null) return null;

  const u = unitMap.get(unitId);
  const isNone = (t?: string | null) => (t ?? "").trim().toLowerCase() === "none";

  let symbol = u?.symbol ?? null;
  if (symbol === "CUR") symbol = countrySymbol || countryCurrency || null;
  if (symbol === "—") symbol = "";

  const rawSuffix = multiplierId != null ? multMap.get(multiplierId)?.suffix ?? "" : "";
  const suffix = APPLY_MULTIPLIER_FACTOR ? "" : rawSuffix;

  const pieces: string[] = [];
  if (symbol && symbol.trim()) pieces.push(symbol.trim());
  if (suffix && suffix.trim()) pieces.push(suffix.trim());
  const label = pieces.join(" ");
  if (label) return label;

  if (!isNone(u?.name)) return (u?.name ?? null) || null;
  return null;
}

function formatDisplayValue(
  value: number | null | undefined,
  unitText?: string | null
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);

  let decimals = 2;
  if (abs >= 1000) decimals = 0;
  else if (abs >= 100) decimals = 1;
  else if (abs >= 10) decimals = 2;
  else if (abs >= 1) decimals = 2;
  else decimals = 3;

  const txt = value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return unitText ? `${txt} ${unitText}` : txt;
}

function compactValueRow(label: string, value?: string | null) {
  if (!value) return "";
  return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;line-height:1.35;">
    <span style="color:#94a3b8;">${label}</span>
    <span style="color:#e2e8f0;text-align:right;">${value}</span>
  </div>`;
}

function trendDirectionGlyph(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "•";
  if (v > 0) return "↑";
  if (v < 0) return "↓";
  return "→";
}

function trendDirectionColor(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "#94a3b8";
  if (v > 0) return "#86efac";
  if (v < 0) return "#fca5a5";
  return "#cbd5e1";
}

function formatTrendValue(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "n/a";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function buildTrendHtml(trend?: NewsTrend | null) {
  if (!trend || (trend.roc3m == null && trend.roc6m == null)) return "";

  const row3 = `<span style="color:${trendDirectionColor(
    trend.roc3m
  )};">3M ${trendDirectionGlyph(trend.roc3m)} ${formatTrendValue(trend.roc3m)}</span>`;
  const row6 = `<span style="color:${trendDirectionColor(
    trend.roc6m
  )};">6M ${trendDirectionGlyph(trend.roc6m)} ${formatTrendValue(trend.roc6m)}</span>`;

  return `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;line-height:1.35;">
    <span style="color:#94a3b8;">Trend</span>
    <span style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">${row3}${row6}</span>
  </div>`;
}

type HistoryCalcRow = {
  timestamp: number;
  actualNorm: number | null;
};

function calcHistoricalRoc(
  historyAsc: HistoryCalcRow[],
  eventTimestamp: number,
  currentActual: number | null,
  monthsBack: 3 | 6
): number | null {
  if (currentActual == null || !Number.isFinite(currentActual)) return null;

  const target = new Date(eventTimestamp);
  target.setUTCMonth(target.getUTCMonth() - monthsBack);
  const targetTs = target.getTime();

  let candidate: number | null = null;
  for (let i = historyAsc.length - 1; i >= 0; i--) {
    const row = historyAsc[i];
    if (row.timestamp <= targetTs && row.actualNorm != null && Number.isFinite(row.actualNorm)) {
      candidate = row.actualNorm;
      break;
    }
  }

  if (candidate == null || candidate === 0) return null;
  return ((currentActual - candidate) / Math.abs(candidate)) * 100;
}

async function fetchNewsOverlay(
  fromIso: string,
  toIso: string,
  minImportance: 2 | 3
): Promise<NewsOverlayEvent[]> {
  const startSecDisplay = toEpochSeconds(fromIso);
  const endSecDisplay = toEpochSeconds(toIso);

  const [unitMap, multMap] = await Promise.all([loadUnitMap(), loadMultiplierMap()]);

  const { data: displayRowsData, error: displayErr } = await supabase
    .from("calendar_values")
    .select(`
      id,
      event_id,
      time,
      actual_value,
      prev_value,
      revised_prev_value,
      event:calendar_events(
        id,
        name,
        importance,
        unit,
        multiplier,
        digits,
        country:calendar_countries(
          code,
          currency,
          currency_symbol
        )
      )
    `)
    .gte("time", startSecDisplay)
    .lte("time", endSecDisplay)
    .order("time", { ascending: false })
    .limit(6000);

  if (displayErr) throw new Error(displayErr.message);

  type RawRow = {
    id: number;
    event_id: number;
    time: number | string | Date;
    actual_value: number | null;
    prev_value: number | null;
    revised_prev_value: number | null;
    event:
      | {
          id: number | null;
          name: string | null;
          importance: number | null;
          unit: number | null;
          multiplier: number | null;
          digits: number | null;
          country:
            | {
                code: string | null;
                currency: string | null;
                currency_symbol: string | null;
              }
            | {
                code: string | null;
                currency: string | null;
                currency_symbol: string | null;
              }[]
            | null;
        }
      | {
          id: number | null;
          name: string | null;
          importance: number | null;
          unit: number | null;
          multiplier: number | null;
          digits: number | null;
          country:
            | {
                code: string | null;
                currency: string | null;
                currency_symbol: string | null;
              }
            | {
                code: string | null;
                currency: string | null;
                currency_symbol: string | null;
              }[]
            | null;
        }[]
      | null;
  };

  const displayRows = (displayRowsData ?? []) as RawRow[];

  const filteredDisplayRows = displayRows.filter((row) => {
    const ev = first(row.event);
    const country = first(ev?.country ?? null);
    const importance = Number(ev?.importance ?? 0);
    const currency = String(country?.currency ?? "").toUpperCase() as CurrencyCode;
    return importance >= minImportance && CURRENCIES.includes(currency);
  });

  const uniqueEventIds = Array.from(
    new Set(
      filteredDisplayRows
        .map((row) => {
          const ev = first(row.event);
          return Number(ev?.id ?? row.event_id ?? 0);
        })
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  const historyByEvent = new Map<number, HistoryCalcRow[]>();

  if (uniqueEventIds.length) {
    const lookbackDate = new Date(fromIso);
    lookbackDate.setUTCMonth(lookbackDate.getUTCMonth() - 7);
    const startSecLookback = Math.floor(lookbackDate.getTime() / 1000);

    const { data: historyRowsData, error: historyErr } = await supabase
      .from("calendar_values")
      .select(`
        event_id,
        time,
        actual_value,
        event:calendar_events(
          id,
          multiplier,
          digits
        )
      `)
      .in("event_id", uniqueEventIds)
      .gte("time", startSecLookback)
      .lte("time", endSecDisplay)
      .order("time", { ascending: true });

    if (!historyErr) {
      type HistoryRawRow = {
        event_id: number;
        time: number | string | Date;
        actual_value: number | null;
        event:
          | {
              id: number | null;
              multiplier: number | null;
              digits: number | null;
            }
          | {
              id: number | null;
              multiplier: number | null;
              digits: number | null;
            }[]
          | null;
      };

      const historyRows = (historyRowsData ?? []) as HistoryRawRow[];

      for (const row of historyRows) {
        const ev = first(row.event);
        const eventId = Number(ev?.id ?? row.event_id ?? 0);
        const digits = Number(ev?.digits ?? 0);
        const factor = ev?.multiplier != null ? multMap.get(ev.multiplier)?.factor ?? 1 : 1;

        const actualNorm = fromMql(row.actual_value, digits, factor);
        const ts = new Date(normalizeUtcIso(row.time)).getTime();

        if (!historyByEvent.has(eventId)) historyByEvent.set(eventId, []);
        historyByEvent.get(eventId)!.push({ timestamp: ts, actualNorm });
      }
    }
  }

  const dedupe = new Map<string, NewsOverlayEvent>();

  for (const row of filteredDisplayRows) {
    const ev = first(row.event);
    const country = first(ev?.country ?? null);

    const importance = Number(ev?.importance ?? 0);
    const currency = String(country?.currency ?? "").toUpperCase() as CurrencyCode;
    if (importance < minImportance) continue;
    if (!CURRENCIES.includes(currency)) continue;

    const time = normalizeUtcIso(row.time);
    const timestamp = new Date(time).getTime();
    const eventId = Number(ev?.id ?? row.event_id ?? 0);
    const title = String(ev?.name ?? "");
    const countryCode = String(country?.code ?? "").toUpperCase();

    const digits = Number(ev?.digits ?? 0);
    const factor = ev?.multiplier != null ? multMap.get(ev.multiplier)?.factor ?? 1 : 1;

    const unitText = buildUnitLabel(
      ev?.unit ?? null,
      ev?.multiplier ?? null,
      unitMap,
      multMap,
      country?.currency ?? null,
      country?.currency_symbol ?? null
    );

    const actualNorm = fromMql(row.actual_value, digits, factor);
    const previousNorm = fromMql(row.revised_prev_value ?? row.prev_value, digits, factor);

    const historyAsc = historyByEvent.get(eventId) ?? [];
    const trend: NewsTrend = {
      roc3m: calcHistoricalRoc(historyAsc, timestamp, actualNorm, 3),
      roc6m: calcHistoricalRoc(historyAsc, timestamp, actualNorm, 6),
    };

    const key = `${eventId}-${timestamp}`;
    if (dedupe.has(key)) continue;

    dedupe.set(key, {
      id: key,
      eventId,
      time,
      timestamp,
      currency,
      countryCode,
      title,
      importance,
      actual: formatDisplayValue(actualNorm, unitText),
      previous: formatDisplayValue(previousNorm, unitText),
      trend,
    });
  }

  return [...dedupe.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function buildNewsMarkers(
  visiblePoints: StrengthPoint[],
  newsEvents: NewsOverlayEvent[]
): Record<CurrencyCode, NewsMarker[]> {
  const markers = {} as Record<CurrencyCode, NewsMarker[]>;
  for (const ccy of CURRENCIES) markers[ccy] = [];

  if (!visiblePoints.length || !newsEvents.length) return markers;

  const pointTimes = visiblePoints.map((p) => new Date(p.time).getTime());

  type Bucket = {
    currency: CurrencyCode;
    snappedTime: string;
    y: number;
    events: NewsOverlayEvent[];
    maxImportance: number;
  };

  const buckets = new Map<string, Bucket>();

  for (const event of newsEvents) {
    let nearestIndex = 0;
    let nearestDistance = Math.abs(pointTimes[0] - event.timestamp);

    for (let i = 1; i < pointTimes.length; i++) {
      const distance = Math.abs(pointTimes[i] - event.timestamp);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const point = visiblePoints[nearestIndex];
    const snappedTime = point.time;
    const y = point.values[event.currency];
    const key = `${event.currency}__${snappedTime}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.events.push(event);
      existing.maxImportance = Math.max(existing.maxImportance, event.importance);
    } else {
      buckets.set(key, {
        currency: event.currency,
        snappedTime,
        y,
        events: [event],
        maxImportance: event.importance,
      });
    }
  }

  for (const bucket of buckets.values()) {
    const count = bucket.events.length;
    const topEvents = bucket.events.slice().sort((a, b) => b.importance - a.importance);

    const tooltipLines = topEvents.slice(0, 6).map((event) => {
      const rows = [
        `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">
          ${event.currency} • ${event.countryCode} • ${importanceLabel(event.importance)}
        </div>`,
        `<div style="font-size:12px;color:#e2e8f0;font-weight:600;line-height:1.35;margin-bottom:6px;">
          ${event.title}
        </div>`,
        compactValueRow("Actual", event.actual),
        compactValueRow("Previous", event.previous),
        buildTrendHtml(event.trend),
      ]
        .filter(Boolean)
        .join("");

      return `<div style="padding:2px 0;">${rows}</div>`;
    });

    const tooltip =
      tooltipLines.join(
        `<div style="height:1px;background:rgba(148,163,184,0.14);margin:8px 0;"></div>`
      ) +
      (topEvents.length > 6
        ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8;">+${
            topEvents.length - 6
          } more</div>`
        : "");

    const highImpact = bucket.maxImportance >= 3;

    markers[bucket.currency].push({
      name: `${bucket.currency} news`,
      coord: [bucket.snappedTime, bucket.y],
      value: count,
      symbol: "circle",
      symbolSize: highImpact ? 22 : 18,
      itemStyle: {
        color: highImpact ? COLORS[bucket.currency] : "rgba(255,255,255,0.92)",
        borderColor: highImpact ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.92)",
        borderWidth: 1.5,
        shadowBlur: highImpact ? 14 : 8,
        shadowColor: highImpact ? COLORS[bucket.currency] : "rgba(255,255,255,0.35)",
      },
      label: {
        show: true,
        formatter: String(count),
        color: highImpact ? "#ffffff" : "#0f172a",
        fontSize: 10,
        fontWeight: 700,
      },
      tooltipHtml: tooltip,
    });
  }

  return markers;
}

function buildNewsHoverPoints(
  markersByCurrency: Record<CurrencyCode, NewsMarker[]>
): Record<CurrencyCode, NewsHoverPoint[]> {
  const result = {} as Record<CurrencyCode, NewsHoverPoint[]>;
  for (const ccy of CURRENCIES) {
    result[ccy] = (markersByCurrency[ccy] ?? []).map((marker) => ({
      value: [marker.coord[0], marker.coord[1], marker.value],
      tooltipHtml: marker.tooltipHtml ?? "",
      symbolSize: Math.max(Number(marker.symbolSize) + 8, 28),
    }));
  }
  return result;
}

function buildNewsLines(newsEvents: NewsOverlayEvent[]): VerticalLine[] {
  const seen = new Set<string>();
  const lines: VerticalLine[] = [];

  for (const event of newsEvents) {
    const key = event.time;
    if (seen.has(key)) continue;
    seen.add(key);

    lines.push({
      xAxis: event.time,
      lineStyle: {
        color:
          event.importance >= 3
            ? "rgba(255,255,255,0.18)"
            : "rgba(148,163,184,0.12)",
        width: event.importance >= 3 ? 1.2 : 1,
        type: event.importance >= 3 ? "solid" : "dashed",
        opacity: 1,
      },
      label: { show: false },
    });
  }

  return lines;
}

function buildDayMarkers(visiblePoints: StrengthPoint[]): VerticalLine[] {
  if (!visiblePoints.length) return [];

  const seen = new Set<string>();
  const lines: VerticalLine[] = [];

  for (const point of visiblePoints) {
    const d = new Date(point.time);
    const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

    if (seen.has(dayKey)) continue;
    seen.add(dayKey);

    lines.push({
      xAxis: point.time,
      lineStyle: {
        color: "rgba(148,163,184,0.06)",
        width: 1,
        type: "solid",
        opacity: 1,
      },
      label: { show: false },
    });
  }

  return lines;
}

function getUtcWeekStartTimestamp(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);

  return d.getTime();
}

function buildWeekMarkers(visiblePoints: StrengthPoint[]): VerticalLine[] {
  if (!visiblePoints.length) return [];

  const seen = new Set<number>();
  const lines: VerticalLine[] = [];

  for (const point of visiblePoints) {
    const d = new Date(point.time);
    const weekStartTs = getUtcWeekStartTimestamp(d);

    if (seen.has(weekStartTs)) continue;
    seen.add(weekStartTs);

    lines.push({
      xAxis: point.time,
      lineStyle: {
        color: "rgba(148,163,184,0.14)",
        width: 1.4,
        type: "solid",
        opacity: 1,
      },
      label: { show: false },
    });
  }

  return lines;
}

export default function CurrencyStrengthPreview({
  limitM5 = 600,
  limitH1 = 1200,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [m5Points, setM5Points] = useState<StrengthPoint[] | null>(null);
  const [h1Points, setH1Points] = useState<StrengthPoint[] | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("market");
  const [focusCurrency, setFocusCurrency] = useState<FocusCurrency>("ALL");
  const [rangeKey, setRangeKey] = useState<RangeKey>("1M");
  const [rebaseMode, setRebaseMode] = useState<RebaseMode>("range");
  const [sessionAnchor, setSessionAnchor] = useState<SessionAnchor>("london");
  const [smoothing, setSmoothing] = useState<SmoothingKey>("34");
  const [newsFilter, setNewsFilter] = useState<NewsFilterKey>("off");
  const [calendarMarkers, setCalendarMarkers] =
    useState<CalendarMarkersKey>("off");

  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsEvents, setNewsEvents] = useState<NewsOverlayEvent[]>([]);

  const isMarketView = viewMode === "market";
  const hasFocusedCurrency = focusCurrency !== "ALL";

  useEffect(() => {
    let cancelled = false;

    async function ensurePrimaryLoaded() {
      try {
        setLoading(true);
        setError(null);

        const neededTf = RANGE_CONFIG[rangeKey].tf;

        if (neededTf === "M5") {
          if (m5Points === null) {
            const built = await fetchAndBuildStrength("M5", limitM5);
            if (!cancelled) setM5Points(built);
          }
        } else {
          if (h1Points === null) {
            const built = await fetchAndBuildStrength("H1", limitH1);
            if (!cancelled) setH1Points(built);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load currency strength"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void ensurePrimaryLoaded();

    return () => {
      cancelled = true;
    };
  }, [rangeKey, limitM5, limitH1, m5Points, h1Points]);

  useEffect(() => {
    let cancelled = false;

    const activeTf = RANGE_CONFIG[rangeKey].tf;
    const otherTf: SourceTf = activeTf === "M5" ? "H1" : "M5";
    const alreadyLoaded = otherTf === "M5" ? m5Points !== null : h1Points !== null;

    if (alreadyLoaded) return;

    const timer = window.setTimeout(async () => {
      try {
        const built = await fetchAndBuildStrength(
          otherTf,
          otherTf === "M5" ? limitM5 : limitH1
        );

        if (cancelled) return;

        if (otherTf === "M5") setM5Points(built);
        else setH1Points(built);
      } catch {
        // silent background prefetch
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [rangeKey, limitM5, limitH1, m5Points, h1Points]);

  const activeTf = RANGE_CONFIG[rangeKey].tf;

  const activeBasePoints = useMemo(() => {
    return activeTf === "M5" ? m5Points ?? [] : h1Points ?? [];
  }, [activeTf, m5Points, h1Points]);

  const visiblePoints = useMemo(() => {
    const bars = RANGE_CONFIG[rangeKey].bars;
    const window = bars === null ? activeBasePoints : activeBasePoints.slice(-bars);

    const anchoredWindow =
      rebaseMode === "session"
        ? sliceFromSessionAnchor(window, sessionAnchor)
        : window;

    const rebased = rebasePoints(anchoredWindow);
    return smoothPoints(rebased, smoothing);
  }, [activeBasePoints, rangeKey, rebaseMode, sessionAnchor, smoothing]);

  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      if (newsFilter === "off" || visiblePoints.length === 0) {
        setNewsEvents([]);
        setNewsError(null);
        setNewsLoading(false);
        return;
      }

      try {
        setNewsLoading(true);
        setNewsError(null);

        const fromIso = visiblePoints[0].time;
        const toIso = visiblePoints[visiblePoints.length - 1].time;
        const minImportance = newsFilter === "high" ? 3 : 2;

        const rows = await fetchNewsOverlay(fromIso, toIso, minImportance);

        if (!cancelled) setNewsEvents(rows);
      } catch (err) {
        if (!cancelled) {
          setNewsError(err instanceof Error ? err.message : "Failed to load news overlay");
          setNewsEvents([]);
        }
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    }

    void loadNews();

    return () => {
      cancelled = true;
    };
  }, [visiblePoints, newsFilter]);

  const visibleNewsEvents = useMemo(() => {
    if (focusCurrency === "ALL") return newsEvents;
    return newsEvents.filter((e) => e.currency === focusCurrency);
  }, [newsEvents, focusCurrency]);

  const latestValues = useMemo(() => {
    const last = visiblePoints[visiblePoints.length - 1];
    return last?.values ?? null;
  }, [visiblePoints]);

  const rankedCurrencies = useMemo(() => {
    if (!latestValues) return [...CURRENCIES];
    return [...CURRENCIES].sort(
      (a, b) => (latestValues[b] ?? 0) - (latestValues[a] ?? 0)
    );
  }, [latestValues]);

  const visibleDriverNames = useMemo(() => {
    if (!hasFocusedCurrency) return [];
    const firstPoint = visiblePoints[0];
    if (!firstPoint) return [];
    return Object.keys(firstPoint.drivers[focusCurrency as CurrencyCode] ?? {});
  }, [visiblePoints, focusCurrency, hasFocusedCurrency]);

  const latestDriverValues = useMemo(() => {
    if (!hasFocusedCurrency) return {};
    const last = visiblePoints[visiblePoints.length - 1];
    return last?.drivers[focusCurrency as CurrencyCode] ?? {};
  }, [visiblePoints, focusCurrency, hasFocusedCurrency]);

  const rankedDrivers = useMemo(() => {
    return [...visibleDriverNames].sort(
      (a, b) => (latestDriverValues[b] ?? 0) - (latestDriverValues[a] ?? 0)
    );
  }, [visibleDriverNames, latestDriverValues]);

  const newsMarkersByCurrency = useMemo(
    () => buildNewsMarkers(visiblePoints, visibleNewsEvents),
    [visiblePoints, visibleNewsEvents]
  );

  const newsHoverPointsByCurrency = useMemo(
    () => buildNewsHoverPoints(newsMarkersByCurrency),
    [newsMarkersByCurrency]
  );

  const newsLines = useMemo(() => buildNewsLines(visibleNewsEvents), [visibleNewsEvents]);

  const dayLines = useMemo(() => buildDayMarkers(visiblePoints), [visiblePoints]);
  const weekLines = useMemo(() => buildWeekMarkers(visiblePoints), [visiblePoints]);

  const newsBySnappedTime = useMemo(() => {
    const map = new Map<string, NewsOverlayEvent[]>();
    if (!visiblePoints.length || !visibleNewsEvents.length) return map;

    const pointTimes = visiblePoints.map((p) => new Date(p.time).getTime());

    for (const event of visibleNewsEvents) {
      let nearestIndex = 0;
      let nearestDistance = Math.abs(pointTimes[0] - event.timestamp);

      for (let i = 1; i < pointTimes.length; i++) {
        const distance = Math.abs(pointTimes[i] - event.timestamp);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      const snappedTime = visiblePoints[nearestIndex].time;
      const arr = map.get(snappedTime) ?? [];
      arr.push(event);
      map.set(snappedTime, arr);
    }

    return map;
  }, [visiblePoints, visibleNewsEvents]);

  const option = useMemo(() => {
    const times = visiblePoints.map((p) => p.time);

    const axisLabelFormatter = (value: string) => {
      const d = new Date(value);
      return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: activeTf === "M5" ? "2-digit" : undefined,
        minute: activeTf === "M5" ? "2-digit" : undefined,
      });
    };

    const showDayMarkers =
      calendarMarkers === "day" || calendarMarkers === "both";
    const showWeekMarkers =
      calendarMarkers === "week" || calendarMarkers === "both";

    const series: Array<Record<string, unknown>> = [];

    if (isMarketView) {
      for (const ccy of CURRENCIES) {
        series.push({
          name: ccy,
          type: "line",
          smooth: 0.25,
          showSymbol: false,
          symbol: "none",
          sampling: "lttb",
          endLabel: {
            show: true,
            formatter: "{a}",
            color: COLORS[ccy],
            fontSize: 11,
            fontWeight: 700,
          },
          labelLayout: { moveOverlap: "shiftY" },
          lineStyle: {
            width: ccy === "USD" ? 3.2 : 2,
            color: COLORS[ccy],
            shadowBlur: 0,
            opacity: ccy === "USD" ? 1 : 0.88,
          },
          emphasis: { focus: "series" },
          data: visiblePoints.map((p) => [p.time, p.values[ccy]]),
          markPoint:
            newsFilter !== "off" && newsMarkersByCurrency[ccy].length
              ? {
                  silent: false,
                  symbolKeepAspect: true,
                  data: newsMarkersByCurrency[ccy].map((m) => ({
                    ...m,
                    tooltip: undefined,
                  })),
                }
              : undefined,
          markLine:
            ((newsFilter !== "off" &&
              hasFocusedCurrency &&
              ccy === focusCurrency &&
              newsLines.length) ||
              (showDayMarkers && dayLines.length) ||
              (showWeekMarkers && weekLines.length))
              ? {
                  silent: true,
                  symbol: ["none", "none"],
                  animation: false,
                  data: [
                    ...(showDayMarkers ? dayLines : []),
                    ...(showWeekMarkers ? weekLines : []),
                    ...(newsFilter !== "off" &&
                    hasFocusedCurrency &&
                    ccy === focusCurrency
                      ? newsLines
                      : []),
                  ],
                }
              : undefined,
        });

        if (
          newsFilter !== "off" &&
          hasFocusedCurrency &&
          ccy === focusCurrency &&
          newsHoverPointsByCurrency[ccy].length
        ) {
          series.push({
            name: `${ccy} News Hover`,
            type: "scatter",
            data: newsHoverPointsByCurrency[ccy],
            symbol: "circle",
            silent: false,
            z: 20,
            itemStyle: {
              color: "rgba(255,255,255,0)",
              borderColor: "rgba(255,255,255,0)",
              opacity: 0,
            },
            emphasis: {
              scale: false,
              itemStyle: {
                color: "rgba(255,255,255,0)",
                borderColor: "rgba(255,255,255,0)",
                opacity: 0,
              },
            },
            symbolSize: (_value: [string, number, number], params: { data?: NewsHoverPoint }) =>
              params?.data?.symbolSize ?? 28,
            tooltip: {
              trigger: "item",
              enterable: false,
              transitionDuration: 0,
              appendToBody: true,
              formatter: (params: { data?: NewsHoverPoint }) =>
                params?.data?.tooltipHtml ?? "",
            },
          });
        }
      }
    }

    if ((viewMode === "index" || viewMode === "both") && hasFocusedCurrency) {
      series.push({
        name: `${focusCurrency} Index`,
        type: "line",
        smooth: 0.25,
        showSymbol: false,
        symbol: "none",
        sampling: "lttb",
        endLabel: {
          show: true,
          formatter: "{a}",
          color: COLORS[focusCurrency as CurrencyCode],
          fontSize: 12,
          fontWeight: 700,
        },
        labelLayout: { moveOverlap: "shiftY" },
        lineStyle: {
          width: 3.6,
          color: COLORS[focusCurrency as CurrencyCode],
          shadowBlur: 0,
        },
        emphasis: { focus: "series" },
        data: visiblePoints.map((p) => [p.time, p.values[focusCurrency as CurrencyCode]]),
        markPoint:
          newsFilter !== "off" && newsMarkersByCurrency[focusCurrency as CurrencyCode].length
            ? {
                silent: false,
                symbolKeepAspect: true,
                data: newsMarkersByCurrency[focusCurrency as CurrencyCode].map((m) => ({
                  ...m,
                  tooltip: undefined,
                })),
              }
            : undefined,
        markLine:
          ((newsFilter !== "off" && newsLines.length) ||
            (showDayMarkers && dayLines.length) ||
            (showWeekMarkers && weekLines.length))
            ? {
                silent: true,
                symbol: ["none", "none"],
                animation: false,
                data: [
                  ...(showDayMarkers ? dayLines : []),
                  ...(showWeekMarkers ? weekLines : []),
                  ...(newsFilter !== "off" ? newsLines : []),
                ],
              }
            : undefined,
      });

      if (newsFilter !== "off" && newsHoverPointsByCurrency[focusCurrency as CurrencyCode].length) {
        series.push({
          name: `${focusCurrency} News Hover`,
          type: "scatter",
          data: newsHoverPointsByCurrency[focusCurrency as CurrencyCode],
          symbol: "circle",
          silent: false,
          z: 20,
          itemStyle: {
            color: "rgba(255,255,255,0)",
            borderColor: "rgba(255,255,255,0)",
            opacity: 0,
          },
          emphasis: {
            scale: false,
            itemStyle: {
              color: "rgba(255,255,255,0)",
              borderColor: "rgba(255,255,255,0)",
              opacity: 0,
            },
          },
          symbolSize: (_value: [string, number, number], params: { data?: NewsHoverPoint }) =>
            params?.data?.symbolSize ?? 28,
          tooltip: {
            trigger: "item",
            enterable: false,
            transitionDuration: 0,
            appendToBody: true,
            formatter: (params: { data?: NewsHoverPoint }) =>
              params?.data?.tooltipHtml ?? "",
          },
        });
      }
    }

    if ((viewMode === "drivers" || viewMode === "both") && hasFocusedCurrency) {
      visibleDriverNames.forEach((driverName, idx) => {
        series.push({
          name: driverName,
          type: "line",
          smooth: 0.25,
          showSymbol: false,
          symbol: "none",
          sampling: "lttb",
          lineStyle: {
            width: viewMode === "both" ? 1.8 : 2.6,
            color: getDriverPanelColor(idx),
            type: viewMode === "both" ? "dashed" : "solid",
            opacity: viewMode === "both" ? 0.85 : 1,
          },
          emphasis: { focus: "series" },
          data: visiblePoints.map((p) => [
            p.time,
            p.drivers[focusCurrency as CurrencyCode]?.[driverName] ?? 0,
          ]),
        });
      });
    }

    const gridRight = isMarketView ? 72 : hasFocusedCurrency ? 118 : 24;

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 140,
      animationDurationUpdate: 140,
      animationEasing: "quadraticOut",
      animationEasingUpdate: "quadraticOut",
      legend: { show: false },
      grid: {
  left: 18,
  right: gridRight,
  top: 20,
  bottom: 18,
  containLabel: true,
},
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove",
        enterable: false,
        transitionDuration: 0,
        appendToBody: true,
        confine: false,
        backgroundColor: "rgba(2, 6, 23, 0.96)",
        borderColor: "rgba(148, 163, 184, 0.16)",
        borderWidth: 1,
        padding: [7, 9],
        extraCssText:
          "box-shadow: 0 8px 20px rgba(0,0,0,0.32); border-radius: 10px;",
        textStyle: { color: "#e2e8f0" },
        axisPointer: {
          type: "line",
          animation: false,
          lineStyle: {
            color: "rgba(255,255,255,0.08)",
            width: 1,
          },
        },
        formatter: (
          params: Array<{ axisValue?: string; seriesName?: string; value?: unknown }>
        ) => {
          const axisValue = params?.[0]?.axisValue ?? "";
          const dateLabel = axisValue
            ? new Date(axisValue).toLocaleString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          const lines: string[] = [
            `<div style="margin-bottom:5px;color:#cbd5e1;font-size:11px;">${dateLabel}</div>`,
          ];

          if (hasFocusedCurrency) {
            const preferredSeriesNames = isMarketView
              ? [focusCurrency]
              : [`${focusCurrency} Index`];

            const match = params.find(
              (p) =>
                typeof p.seriesName === "string" &&
                preferredSeriesNames.includes(p.seriesName)
            );

            if (match) {
              const raw = Array.isArray(match.value) ? match.value[1] : match.value;
              const val = typeof raw === "number" ? raw : Number(raw);
              if (Number.isFinite(val)) {
                lines.push(
                  `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;line-height:1.35;">
                    <span style="color:#e2e8f0;">${match.seriesName}</span>
                    <span style="color:${val >= 0 ? "#86efac" : "#fca5a5"};">${
                      val >= 0 ? "+" : ""
                    }${val.toFixed(2)}%</span>
                  </div>`
                );
              }
            }
          }

          const events = axisValue ? newsBySnappedTime.get(axisValue) ?? [] : [];
          if (events.length) {
            lines.push(
              `<div style="margin-top:7px;border-top:1px solid rgba(148,163,184,0.14);padding-top:6px;color:#94a3b8;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">News</div>`
            );

            for (const event of events.slice(0, 3)) {
              lines.push(
                `<div style="font-size:11px;color:#e2e8f0;line-height:1.35;">
                  <span style="color:#94a3b8;">${event.currency} • ${event.countryCode}</span>
                  <br/>
                  <span>${truncateText(event.title, 38)}</span>
                </div>`
              );
            }

            if (events.length > 3) {
              lines.push(
                `<div style="font-size:11px;color:#94a3b8;">+${events.length - 3} more</div>`
              );
            }
          }

          return lines.join("");
        },
      },
      xAxis: {
        type: "category",
        data: times,
        boundaryGap: false,
        axisLabel: {
          color: "#94a3b8",
          hideOverlap: true,
          formatter: axisLabelFormatter,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: {
          color: "#94a3b8",
          formatter: (v: number) => `${v.toFixed(2)}%`,
        },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.09)" } },
      },
      series,
    };
  }, [
    visiblePoints,
    activeTf,
    viewMode,
    focusCurrency,
    visibleDriverNames,
    newsFilter,
    newsMarkersByCurrency,
    newsHoverPointsByCurrency,
    newsLines,
    newsBySnappedTime,
    calendarMarkers,
    dayLines,
    weekLines,
    isMarketView,
    hasFocusedCurrency,
  ]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Currency Strength Preview</h3>
            <p className="mt-1 text-sm text-slate-400">
              28-pair currency strength engine with smoothing, rebasing, drivers, and
              news overlays.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {loading
                ? `Loading ${RANGE_CONFIG[rangeKey].tf} data...`
                : `${visiblePoints.length} visible points · source ${activeTf} · rebase ${
                    rebaseMode === "range" ? "range" : SESSION_LABELS[sessionAnchor]
                  } · smoothing ${smoothing === "off" ? "off" : smoothing} · calendar markers ${calendarMarkers} · news ${
                    newsFilter === "off"
                      ? "off"
                      : newsFilter === "high"
                      ? "high only"
                      : "moderate + high"
                  } · overlay ${
                    newsLoading ? "loading" : visibleNewsEvents.length
                  } events · focus ${focusCurrency === "ALL" ? "neutral" : focusCurrency}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="min-w-[130px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Focus
              </div>
              <select
                value={focusCurrency}
                onChange={(e) => setFocusCurrency(e.target.value as FocusCurrency)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="ALL" className="bg-slate-900">
                  Neutral
                </option>
                {CURRENCIES.map((ccy) => (
                  <option key={ccy} value={ccy} className="bg-slate-900">
                    {ccy}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[140px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                View
              </div>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="market" className="bg-slate-900">
                  Market
                </option>
                <option value="index" className="bg-slate-900">
                  Index
                </option>
                <option value="drivers" className="bg-slate-900">
                  Drivers
                </option>
                <option value="both" className="bg-slate-900">
                  Both
                </option>
              </select>
            </label>

            <label className="min-w-[120px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Period
              </div>
              <select
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value as RangeKey)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                {Object.entries(RANGE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key} className="bg-slate-900">
                    {cfg.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[130px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Rebase
              </div>
              <select
                value={rebaseMode}
                onChange={(e) => setRebaseMode(e.target.value as RebaseMode)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="range" className="bg-slate-900">
                  Range
                </option>
                <option value="session" className="bg-slate-900">
                  Session
                </option>
              </select>
            </label>

            {rebaseMode === "session" && (
              <label className="min-w-[140px]">
                <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  Session
                </div>
                <select
                  value={sessionAnchor}
                  onChange={(e) => setSessionAnchor(e.target.value as SessionAnchor)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="asia" className="bg-slate-900">
                    Asia
                  </option>
                  <option value="london" className="bg-slate-900">
                    London
                  </option>
                  <option value="newyork" className="bg-slate-900">
                    New York
                  </option>
                </select>
              </label>
            )}

            <label className="min-w-[120px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Smoothing
              </div>
              <select
                value={smoothing}
                onChange={(e) => setSmoothing(e.target.value as SmoothingKey)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="off" className="bg-slate-900">
                  Off
                </option>
                <option value="3" className="bg-slate-900">
                  3
                </option>
                <option value="5" className="bg-slate-900">
                  5
                </option>
                <option value="8" className="bg-slate-900">
                  8
                </option>
                <option value="13" className="bg-slate-900">
                  13
                </option>
                <option value="21" className="bg-slate-900">
                  21
                </option>
                <option value="34" className="bg-slate-900">
                  34
                </option>
                <option value="55" className="bg-slate-900">
                  55
                </option>
              </select>
            </label>

            <label className="min-w-[170px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Calendar Markers
              </div>
              <select
                value={calendarMarkers}
                onChange={(e) => setCalendarMarkers(e.target.value as CalendarMarkersKey)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="off" className="bg-slate-900">
                  Off
                </option>
                <option value="day" className="bg-slate-900">
                  Day
                </option>
                <option value="week" className="bg-slate-900">
                  Week
                </option>
                <option value="both" className="bg-slate-900">
                  Day + Week
                </option>
              </select>
            </label>

            <label className="min-w-[150px]">
              <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                News
              </div>
              <select
                value={newsFilter}
                onChange={(e) => setNewsFilter(e.target.value as NewsFilterKey)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="off" className="bg-slate-900">
                  Off
                </option>
                <option value="high" className="bg-slate-900">
                  High only
                </option>
                <option value="mediumHigh" className="bg-slate-900">
                  Moderate + High
                </option>
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {newsError ? (
          <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            News overlay error: {newsError}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded-2xl border border-white/10 bg-black p-2">
          <ReactECharts
            option={option}
            style={{ height: 500, width: "100%" }}
            notMerge={false}
            lazyUpdate={true}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          {isMarketView ? (
            <>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Strength Ranking
              </div>

              <div className="space-y-2">
                {rankedCurrencies.map((ccy) => {
                  const value = latestValues?.[ccy];
                  const positive = (value ?? 0) >= 0;

                  return (
                    <div
                      key={ccy}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: COLORS[ccy] }}
                        />
                        <span className="font-medium text-white">{ccy}</span>
                      </div>

                      <span
                        className={
                          positive ? "text-emerald-300 text-sm" : "text-red-300 text-sm"
                        }
                      >
                        {fmt(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : hasFocusedCurrency ? (
            <>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                {focusCurrency} Summary
              </div>

              <div className="mb-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[focusCurrency as CurrencyCode] }}
                    />
                    <span className="font-medium text-white">{focusCurrency} Index</span>
                  </div>
                  <span
                    className={
                      (latestValues?.[focusCurrency as CurrencyCode] ?? 0) >= 0
                        ? "text-emerald-300 text-sm"
                        : "text-red-300 text-sm"
                    }
                  >
                    {fmt(latestValues?.[focusCurrency as CurrencyCode])}
                  </span>
                </div>
              </div>

              <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Relative Performance
              </div>

              <div className="space-y-2">
                {rankedDrivers.map((driverName, idx) => {
                  const value = latestDriverValues?.[driverName];
                  const positive = (value ?? 0) >= 0;

                  return (
                    <div
                      key={driverName}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getDriverPanelColor(idx) }}
                        />
                        <span className="font-medium text-white">{driverName}</span>
                      </div>

                      <span
                        className={
                          positive ? "text-emerald-300 text-sm" : "text-red-300 text-sm"
                        }
                      >
                        {fmt(value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-slate-300">
              Choose a focus currency or switch back to Market view.
            </div>
          )}

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-slate-400">
            {isMarketView
              ? "Neutral focus keeps the market view cleaner. Pick a currency only when you want its news line and hover targets emphasised."
              : "Relative Performance labels are shown from the perspective of the focused currency, so positive values read as strength of that currency versus the comparison currency."}
          </div>
        </div>
      </div>
    </div>
  );
}