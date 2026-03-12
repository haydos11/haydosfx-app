"use client";

import { useEffect, useMemo, useState } from "react";
import { EconCard } from "@/components/economy/EconCard";

type Point = { date: string; value: number };

type CardSeries = {
  slug?: string;
  preferred?: boolean;
  id: string;
  label: string;
  units: "level" | "pct";
  decimals: number;
  latest: number | null;
  latestDate: string | null;
  points: Point[];
};

type Range = "ytd" | "1y" | "2y" | "3y" | "5y" | "10y" | "max";

const DEFAULT_RANGE: Range = "3y";
const RANGES: Range[] = ["ytd", "1y", "2y", "3y", "5y", "10y", "max"];

const toISO = (d: Date) => d.toISOString().slice(0, 10);

function shiftMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function shiftYears(base: Date, years: number): Date {
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function displayStartFor(r: Range): string {
  const now = new Date();

  if (r === "max") return "1990-01-01";

  if (r === "ytd") {
    return toISO(new Date(now.getFullYear(), 0, 1));
  }

  const years: Record<Exclude<Range, "ytd" | "max">, number> = {
    "1y": 1,
    "2y": 2,
    "3y": 3,
    "5y": 5,
    "10y": 10,
  };

  return toISO(shiftYears(now, -years[r]));
}

function fetchStartFor(r: Range): string {
  if (r === "max") return "1990-01-01";

  const displayStart = new Date(`${displayStartFor(r)}T00:00:00`);
  return toISO(shiftMonths(displayStart, -14));
}

function trimPointsToRange(points: Point[], startIso: string): Point[] {
  return points.filter((p) => p.date >= startIso);
}

function withTrimmedLatest(series: CardSeries, visibleStart: string): CardSeries | null {
  const trimmedPoints = trimPointsToRange(series.points ?? [], visibleStart);
  if (!trimmedPoints.length) return null;

  const latest = trimmedPoints[trimmedPoints.length - 1];

  return {
    ...series,
    latest: latest.value,
    latestDate: latest.date,
    points: trimmedPoints,
  };
}

export default function ChEconomyPage() {
  const [entries, setEntries] = useState<CardSeries[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [showTrend, setShowTrend] = useState(false);

  const visibleStart = useMemo(() => displayStartFor(range), [range]);
  const fetchStart = useMemo(() => fetchStartFor(range), [range]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/economy?country=ch&set=core&start=${fetchStart}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error(await res.text());

        const json: { series?: CardSeries[]; error?: string } = await res.json();

        const rawSeries: CardSeries[] = json.series ?? [];

        const trimmed = rawSeries
          .map((s) => withTrimmedLatest(s, visibleStart))
          .filter((s): s is CardSeries => Boolean(s))
          .filter((s) => (s.points?.length ?? 0) > 0);

        if (!cancelled) {
          setEntries(trimmed);
          setErr(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setEntries([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchStart, visibleStart]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Switzerland Economy Snapshot</h1>
          <p className="mt-1 text-sm text-slate-400">
            Trial snapshot built from calendar history for key Switzerland inflation,
            growth, labour, policy and positioning indicators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrend((s) => !s)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
          >
            {showTrend ? "Hide ROC 3m vs 6m" : "Show ROC 3m vs 6m"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              range === r
                ? "bg-violet-600 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
            aria-pressed={range === r}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      {err && <div className="text-red-400">{err}</div>}

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
        {entries.map((s, idx) => (
          <EconCard
            key={`${s.slug ?? s.id}:${range}:${idx}`}
            title={s.label}
            latest={s.latest}
            units={s.units}
            decimals={s.decimals}
            points={s.points}
            showTrend={showTrend}
          />
        ))}
      </div>
    </div>
  );
}