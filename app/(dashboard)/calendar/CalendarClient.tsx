// app/(dashboard)/calendar/CalendarClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CalendarTable from "./components/CalendarTable";
import { useCalendar } from "./hooks/useCalendar";
import dynamic from "next/dynamic";
import type { CalendarEventRow } from "./types";

// lazy-load the drawer (client-only)
const CalendarEventDrawer = dynamic(() => import("./components/CalendarEventDrawer"), { ssr: false });

/* ------------ UTC date helpers ------------ */
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfWeekUTC(d = todayUTC()) {
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1..Sun=7
  const s = new Date(d);
  s.setUTCDate(s.getUTCDate() - (dow - 1));
  return s;
}
function endOfWeekUTC(d = todayUTC()) {
  const s = startOfWeekUTC(d);
  const e = new Date(s);
  e.setUTCDate(s.getUTCDate() + 6);
  return e;
}
function firstOfMonthUTC(d = todayUTC()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function lastOfMonthUTC(d = todayUTC()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}
function addMonthsUTC(d: Date, delta: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, d.getUTCDate()));
}
function clampISO(a: string, b: string) {
  return a <= b ? [a, b] : [b, a];
}

/* ------------ Range calendar (single grid, blue shaded band) ------------ */
type Range = { start: string; end: string };

function sameYMD(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function RangeCalendar({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const initial = new Date(value.start + "T00:00:00Z");
  const [view, setView] = useState<Date>(
    new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1))
  );
  const [phase, setPhase] = useState<"idle" | "pickingEnd">("idle");

  const start = new Date(value.start + "T00:00:00Z");
  const end = new Date(value.end + "T00:00:00Z");

  const first = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth(), 1));
  const firstDow = first.getUTCDay() === 0 ? 7 : first.getUTCDay();
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - (firstDow - 1));
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    days.push(d);
  }

  const inMonth = (d: Date) => d.getUTCMonth() === view.getUTCMonth();
  const inRange = (d: Date) => d >= start && d <= end;
  const isStart = (d: Date) => sameYMD(d, start);
  const isEnd = (d: Date) => sameYMD(d, end);

  function clickDay(d: Date) {
    const iso = toISO(d);
    if (phase === "idle") {
      onChange({ start: iso, end: iso });
      setPhase("pickingEnd");
      return;
    }
    const [s, e] = clampISO(value.start, iso);
    onChange({ start: s, end: e });
    setPhase("idle");
  }

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(view);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setView(addMonthsUTC(view, -1))}
          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
        >
          ←
        </button>
        <div className="text-sm font-medium text-slate-200">{monthLabel}</div>
        <button
          onClick={() => setView(addMonthsUTC(view, +1))}
          className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* zero gap for continuous band */}
      <div className="mt-1 grid grid-cols-7 gap-0">
        {days.map((d, idx) => {
          const _inMonth = inMonth(d);
          const _inRange = inRange(d);
          const _isStart = isStart(d);
          const _isEnd = isEnd(d);

          const clsBase =
            "relative select-none px-0 py-1.5 text-sm tabular-nums border border-white/10";
          // Stronger band: indigo tint for range, solid indigo for endpoints
          const bg =
            _isStart || _isEnd
              ? "bg-indigo-600/80 text-white"
              : _inRange
              ? "bg-indigo-500/25 text-slate-100"
              : _inMonth
              ? "bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]"
              : "bg-white/[0.02] text-slate-500";

          const roundL = _isStart ? "rounded-l-md" : "";
          const roundR = _isEnd ? "rounded-r-md" : "";

          return (
            <button
              key={idx}
              onClick={() => clickDay(d)}
              className={`${clsBase} ${bg} ${roundL} ${roundR}`}
            >
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------ click-away + small UI ------------ */
function useClickAway<T extends HTMLElement>(onAway: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) onAway();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onAway();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onAway]);
  return ref;
}

function Pill({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200 hover:bg-white/[0.08] transition"
    >
      {children}
    </button>
  );
}

type Option = { value: string; label: string };

/* ------------ Reusable MultiSelect (checkbox popover) ------------ */
function MultiSelect({
  label,
  options,
  selected,
  setSelected,
  footer,
  className = "",
}: {
  label: string;
  options: Option[];
  selected: string[];
  setSelected: (v: string[]) => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));
  const toggle = (val: string) =>
    setSelected(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val]);

  const allVals = options.map((o) => o.value);
  const labelText =
    selected.length === 0
      ? label
      : selected.length === allVals.length
      ? `${label}: All`
      : `${label}: ${selected.length}`;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04] transition"
      >
        {labelText}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-[300px] rounded-2xl border border-white/10 bg-[#0c0c0c]/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setSelected(allVals)}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
            >
              Select all
            </button>
            <button
              onClick={() => setSelected([])}
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
            >
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-auto pr-1">
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-white/[0.06]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="h-4 w-4"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {footer ? <div className="mt-2 border-t border-white/10 pt-2">{footer}</div> : null}
        </div>
      )}
    </div>
  );
}

/* ------------ Timezone helpers & select (supports :30) ------------ */
type TZOpt = { value: number; label: string };

/** Format e.g. 9.5 -> "UTC+9:30", -3.5 -> "UTC−3:30" */
function formatUtcOffset(val: number) {
  const sign = val >= 0 ? "+" : "−";
  const abs = Math.abs(val);
  const hours = Math.floor(abs);
  const mins = Math.round((abs - hours) * 60);
  return `UTC${sign}${hours}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

/** Better local offset detection: uses shortOffset (handles :30), falls back to getTimezoneOffset */
function detectLocalOffset(): number {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "shortOffset" }).formatToParts(new Date());
    const raw = parts.find(p => p.type === "timeZoneName")?.value || ""; // e.g. "GMT+9:30"
    const m = raw.match(/([+-]\d{1,2})(?::(\d{2}))?/);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const frac = min >= 30 ? 0.5 : 0;
      const val = h + frac;
      const snapped = Math.round(val * 2) / 2;
      return Math.max(-12, Math.min(14, snapped));
    }
  } catch {
    /* noop */
  }
  const hours = -new Date().getTimezoneOffset() / 60;
  const snapped = Math.round(hours * 2) / 2;
  return Math.max(-12, Math.min(14, snapped));
}

// Neutral labels to avoid “Berlin vs London” confusion
const TZ_ALL: TZOpt[] = [
  { value: -12,  label: "UTC−12" },
  { value: -11,  label: "UTC−11" },
  { value: -10,  label: "UTC−10" },
  { value: -9,   label: "UTC−9"  },
  { value: -8,   label: "UTC−8"  },
  { value: -7,   label: "UTC−7"  },
  { value: -6,   label: "UTC−6"  },
  { value: -5,   label: "UTC−5"  },
  { value: -4,   label: "UTC−4"  },
  { value: -3.5, label: "UTC−3:30" },
  { value: -3,   label: "UTC−3"  },
  { value: -2,   label: "UTC−2"  },
  { value: -1,   label: "UTC−1"  },
  { value: 0,    label: "UTC±0"  },
  { value: 1,    label: "UTC+1"  },
  { value: 2,    label: "UTC+2"  },
  { value: 3,    label: "UTC+3"  },
  { value: 3.5,  label: "UTC+3:30" },
  { value: 4,    label: "UTC+4"  },
  { value: 4.5,  label: "UTC+4:30" },
  { value: 5,    label: "UTC+5"  },
  { value: 5.5,  label: "UTC+5:30" },
  { value: 6,    label: "UTC+6"  },
  { value: 6.5,  label: "UTC+6:30" },
  { value: 7,    label: "UTC+7"  },
  { value: 8,    label: "UTC+8"  },
  { value: 9,    label: "UTC+9"  },
  { value: 9.5,  label: "UTC+9:30" },
  { value: 10,   label: "UTC+10" },
  { value: 11,   label: "UTC+11" },
  { value: 12,   label: "UTC+12" },
  { value: 13,   label: "UTC+13" },
  { value: 14,   label: "UTC+14" },
];

function TimezoneSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const popRef = useClickAway<HTMLDivElement>(() => setOpen(false));
  const zeroRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open && zeroRef.current) zeroRef.current.scrollIntoView({ block: "center" });
  }, [open]);

  const current = TZ_ALL.find((o) => o.value === value) ?? TZ_ALL.find((o) => o.value === 0)!;

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04] transition"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400" />
        <span>{`${current.label}`}</span>
        <svg
          className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-[220px] rounded-2xl border border-white/10 bg-[#0c0c0c]/95 p-2 shadow-2xl backdrop-blur">
          <div className="max-h-64 overflow-auto">
            {TZ_ALL.map((opt) => {
              const selected = opt.value === value;
              const base =
                "w-full text-left rounded-md px-3 py-2 text-sm hover:bg-white/[0.06] text-slate-200 flex items-center justify-between";
              return (
                <button
                  key={opt.value}
                  ref={opt.value === 0 ? zeroRef : null}
                  className={`${base} ${selected ? "bg-white/[0.08]" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {selected ? <span className="text-emerald-300 text-xs">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------ Main component ------------ */
export default function CalendarClient() {
  // defaults: this week
  const defaultStart = useMemo(() => toISO(startOfWeekUTC()), []);
  const defaultEnd = useMemo(() => toISO(endOfWeekUTC()), []);
  const [range, setRange] = useState<Range>({ start: defaultStart, end: defaultEnd });
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  /* ---- Timezone offset (UTC) — auto-detect on first load (supports :30) ---- */
  const [tzOffset, setTzOffset] = useState<number>(detectLocalOffset());

  /* Countries (expanded) */
  const COUNTRY_OPTIONS: Option[] = [
    { value: "US", label: "United States (USD)" },
    { value: "GB", label: "United Kingdom (GBP)" },
    { value: "EU", label: "Euro Area (EUR)" },
    { value: "JP", label: "Japan (JPY)" },
    { value: "CA", label: "Canada (CAD)" },
    { value: "AU", label: "Australia (AUD)" },
    { value: "NZ", label: "New Zealand (NZD)" },
    { value: "CH", label: "Switzerland (CHF)" },
    { value: "CN", label: "China (CNY)" },
    { value: "MX", label: "Mexico (MXN)" },
    { value: "ZA", label: "South Africa (ZAR)" },
    { value: "SE", label: "Sweden (SEK)" },
    { value: "NO", label: "Norway (NOK)" },
    { value: "DK", label: "Denmark (DKK)" },
    { value: "HK", label: "Hong Kong (HKD)" },
    { value: "SG", label: "Singapore (SGD)" },
    { value: "KR", label: "South Korea (KRW)" },
  ];
  const G9_FX = ["EU", "US", "GB", "JP", "CA", "AU", "NZ", "CH", "CN"];
  const [countriesSel, setCountriesSel] = useState<string[]>(G9_FX);

  const SECTOR_OPTIONS: Option[] = [
    { value: "Market", label: "Market" },
    { value: "GDP", label: "GDP" },
    { value: "Jobs", label: "Jobs" },
    { value: "Prices", label: "Prices" },
    { value: "Money", label: "Money" },
    { value: "Trade", label: "Trade" },
    { value: "Government", label: "Government" },
    { value: "Business", label: "Business" },
    { value: "Consumer", label: "Consumer" },
    { value: "Housing", label: "Housing" },
    { value: "Taxes", label: "Taxes" },
    { value: "Holidays", label: "Holidays" },
  ];
  const [sectorsSel, setSectorsSel] = useState<string[]>([]);

  const IMPACT_OPTIONS: Option[] = [
    { value: "1", label: "Low" },
    { value: "2", label: "Moderate" },
    { value: "3", label: "High" },
  ];
  const [impactSel, setImpactSel] = useState<string[]>([]);

  const encodedCountry = useMemo(() => {
    const parts: string[] = [];
    if (countriesSel.length) parts.push(countriesSel.join(","));
    if (sectorsSel.length) parts.push(`sector=${sectorsSel.join(",")}`);
    if (impactSel.length) parts.push(`impact=${impactSel.join(",")}`);
    return parts.join(" | ");
  }, [countriesSel, sectorsSel, impactSel]);

  const { data, loading, error } = useCalendar({
    start: range.start,
    end: range.end,
    country: encodedCountry,
    page,
    pageSize,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* Popover state for range */
  const [open, setOpen] = useState(false);
  const popRef = useClickAway<HTMLDivElement>(() => setOpen(false));

  /* Quick ranges */
  const setToday = () => {
    const t = toISO(todayUTC());
    setRange({ start: t, end: t });
    setPage(1);
  };
  const setLastWeek = () => {
    const mon = startOfWeekUTC();
    const lastMon = new Date(mon);
    lastMon.setUTCDate(mon.getUTCDate() - 7);
    const lastSun = new Date(lastMon);
    lastSun.setUTCDate(lastMon.getUTCDate() + 6);
    setRange({ start: toISO(lastMon), end: toISO(lastSun) });
    setPage(1);
  };
  const setThisWeek = () => {
    setRange({ start: toISO(startOfWeekUTC()), end: toISO(endOfWeekUTC()) });
    setPage(1);
  };
  const setNextWeek = () => {
    const nextMon = new Date(startOfWeekUTC());
    nextMon.setUTCDate(nextMon.getUTCDate() + 7);
    const nextSun = new Date(nextMon);
    nextSun.setUTCDate(nextMon.getUTCDate() + 6);
    setRange({ start: toISO(nextMon), end: toISO(nextSun) });
    setPage(1);
  };
  const setThisMonth = () => {
    setRange({ start: toISO(firstOfMonthUTC()), end: toISO(lastOfMonthUTC()) });
    setPage(1);
  };
  const setNextMonth = () => {
    const firstNext = firstOfMonthUTC(addMonthsUTC(todayUTC(), 1));
    const lastNext = lastOfMonthUTC(firstNext);
    setRange({ start: toISO(firstNext), end: toISO(lastNext) });
    setPage(1);
  };

  /* -------- Drawer state -------- */
  const [drawer, setDrawer] = useState<{ open: boolean; eventId: number | null }>({
    open: false,
    eventId: null,
  });

  type ExtraIdFields = Partial<{ event_id: number | string | null; eventId: number | string | null }>;
  function handleSelect(row: CalendarEventRow) {
    const extras = row as unknown as ExtraIdFields;
    const idRaw =
      row.event_code ??
      extras.event_id ??
      extras.eventId ??
      null;

    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum)) return;

    setDrawer({ open: true, eventId: idNum });
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Economic Calendar</h1>
      <p className="mt-1 text-xs text-slate-400">
        Times shown in {formatUtcOffset(tzOffset)}
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: range + pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={popRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06] transition"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400" />
              {range.start} <span className="mx-1 text-slate-500">→</span> {range.end}
            </button>

            {open && (
              <div className="absolute z-20 mt-2 w-[420px] rounded-2xl border border-white/10 bg-[#0c0c0c]/95 p-4 shadow-2xl backdrop-blur">
                <div className="mb-3 text-xs uppercase tracking-wide text-slate-400">
                  Select a date range (single calendar)
                </div>

                <RangeCalendar
                  value={range}
                  onChange={(r) => {
                    setRange(r);
                    setPage(1);
                  }}
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill onClick={() => { setToday(); setOpen(false); }}>Today</Pill>
                  <Pill onClick={() => { setLastWeek(); setOpen(false); }}>Last week</Pill>
                  <Pill onClick={() => { setThisWeek(); setOpen(false); }}>This week</Pill>
                  <Pill onClick={() => { setNextWeek(); setOpen(false); }}>Next week</Pill>
                  <Pill onClick={() => { setThisMonth(); setOpen(false); }}>This month</Pill>
                  <Pill onClick={() => { setNextMonth(); setOpen(false); }}>Next month</Pill>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-sm text-white hover:bg-indigo-600"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inline pills */}
          <Pill onClick={setToday}>Today</Pill>
          <Pill onClick={setLastWeek}>Last week</Pill>
          <Pill onClick={setThisWeek}>This week</Pill>
          <Pill onClick={setNextWeek}>Next week</Pill>
          <Pill onClick={setThisMonth}>This month</Pill>
          <Pill onClick={setNextMonth}>Next month</Pill>
        </div>

        {/* Right: filters + timezone */}
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            label="Countries"
            options={COUNTRY_OPTIONS}
            selected={countriesSel}
            setSelected={(v) => {
              setCountriesSel(v);
              setPage(1);
            }}
            footer={
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCountriesSel([])}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:bg-white/[0.08]"
                >
                  Clear
                </button>
                <button
                  onClick={() => setCountriesSel(G9_FX)}
                  className="rounded-md bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                >
                  G9 FX preset
                </button>
              </div>
            }
          />

          <MultiSelect
            label="Sector"
            options={SECTOR_OPTIONS}
            selected={sectorsSel}
            setSelected={(v) => {
              setSectorsSel(v);
              setPage(1);
            }}
          />

          <MultiSelect
            label="Impact"
            options={IMPACT_OPTIONS}
            selected={impactSel}
            setSelected={(v) => {
              setImpactSel(v);
              setPage(1);
            }}
          />

          <TimezoneSelect value={tzOffset} onChange={setTzOffset} />
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="mt-4 rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {typeof error === "string" ? error : "Failed to load data. Check RLS/view name and API."}
        </div>
      ) : null}

      {/* Table */}
      <CalendarTable
        items={data?.items ?? []}
        loading={loading}
        error={error}
        timeOffsetHours={tzOffset}
        onSelect={handleSelect}
      />

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          {total ? `Total: ${total} • Page ${page}/${totalPages}` : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Drawer */}
      <CalendarEventDrawer
        open={drawer.open}
        eventId={drawer.eventId}
        onOpenChange={(open) =>
          setDrawer((s) => ({ open, eventId: open ? s.eventId : null }))
        }
      />
    </div>
  );
}
