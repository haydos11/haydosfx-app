// app/(dashboard)/economy/us/page.tsx
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


/** Fetch start (WITH ~14m lookback) — keeps YoY calc/context intact server-side */
function fetchStartFor(r: Range): string {
  if (r === "max") return "1990-01-01";
  const now = new Date();

  const minusMonths = (base: Date, months: number) => {
    const d = new Date(base);
    d.setMonth(d.getMonth() - months);
    return d;
  };

  if (r === "ytd") {
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return toISO(minusMonths(jan1, 14));
  }
  const years: Record<Exclude<Range, "ytd" | "max">, number> = {
    "1y": 1, "2y": 2, "3y": 3, "5y": 5, "10y": 10,
  };
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - years[r as Exclude<Range, "ytd" | "max">]);
  return toISO(minusMonths(d, 14));
}

/* ---------- pairing helpers ---------- */
const YOY_RE = /\b(yoy|y\/y)\b|\(\s*yoy\s*\)|\(\s*y\/y\s*\)/i;
const MOM_RE = /\b(mom|m\/m)\b|\(\s*mom\s*\)|\(\s*m\/m\s*\)/i;

function normalizeKey(s: string) {
  return s
    .replace(YOY_RE, "")
    .replace(MOM_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[()]/g, "")
    .trim()
    .toLowerCase();
}
const looksYoY = (s: CardSeries) => YOY_RE.test(s.label) || (s.slug ? YOY_RE.test(s.slug) : false);
const looksMoM = (s: CardSeries) => MOM_RE.test(s.label) || (s.slug ? MOM_RE.test(s.slug) : false);

export default function UsEconomyPage() {
  const [entries, setEntries] = useState<CardSeries[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [showTrend, setShowTrend] = useState(false);

  const fetchStart = useMemo(() => fetchStartFor(range), [range]);
  // Note: viewStart/clamp no longer needed since EconCard handles full series itself
  // const clampStart = useMemo(() => viewStartFor(range), [range]); // unused now
  // const clampEnd = useMemo(() => toISO(new Date()), []);          // unused now

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/economy?country=us&set=core&start=${fetchStart}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(await res.text());
        const json: { series?: CardSeries[] } = await res.json();
        const series: CardSeries[] = (json.series ?? []).filter(s => (s.points?.length ?? 0) > 0);

        // Group by normalized base key (from slug OR label)
        const groups = new Map<string, CardSeries[]>();
        for (const s of series) {
          const base = normalizeKey(s.slug ?? s.label);
          const arr = groups.get(base);
          if (arr) arr.push(s);
          else groups.set(base, [s]);
        }

        const out: CardSeries[] = [];
        for (const [, arr] of groups) {
          const yoy = arr.find(looksYoY);
          const mom = arr.find(looksMoM);
          if (yoy) out.push(yoy);
          if (mom) out.push(mom);
          if (!yoy && !mom) {
            const pref = arr.find((x) => x.preferred) ?? arr[0];
            out.push(pref);
          }
        }

        setEntries(out);
        setErr(null);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
        setEntries([]);
      }
    })();
  }, [fetchStart]);

  return (
    <div className="w-full space-y-4">
      {/* controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowTrend((s) => !s)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
        >
          {showTrend ? "Hide ROC 3m vs 6m" : "Show ROC 3m vs 6m"}
        </button>

        <div className="flex gap-2">
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
      </div>

      {err && <div className="text-red-400">{err}</div>}

      {/* grid */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
        {entries.map((s, idx) => (
          <EconCard
            key={s.slug ?? `${s.id}:${s.label}:${idx}`}
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
