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

/* ------------ Timezone helpers & compact GMT picker (DST aware) ------------ */
type TZCity = { tz: string; city: string };

/** Compute current GMT offset (hours, can be .5/.75) for an IANA TZ id. */
function offsetHoursFor(tz: string): number {
  const now = new Date();
  // Difference (in minutes) between UTC clock and target TZ clock
  const diffMin =
    (Date.parse(now.toLocaleString("en-US", { timeZone: "UTC", hour12: false })) -
      Date.parse(now.toLocaleString("en-US", { timeZone: tz, hour12: false }))) / 60000;
  // If TZ is ahead of UTC, diffMin is negative; flip sign and convert to hours
  return Math.round((-diffMin / 60) * 2) / 2; // snap to nearest 0.5h
}

/** "GMT+1:30" / "GMT-3" formatter */
function fmtGMT(val: number) {
  const sign = val >= 0 ? "+" : "-";
  const abs = Math.abs(val);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Best-effort local IANA time zone id */
function detectLocalTzId(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

/** Curated list: one representative city per zone (includes half-hours). */
const TZ_CITIES: TZCity[] = [
  { tz: "Etc/GMT+12", city: "Baker Isl." },
  { tz: "Pacific/Pago_Pago", city: "Pago Pago" },
  { tz: "Pacific/Honolulu", city: "Honolulu" },
  { tz: "America/Anchorage", city: "Anchorage" },
  { tz: "America/Los_Angeles", city: "Los Angeles" },
  { tz: "America/Denver", city: "Denver" },
  { tz: "America/Chicago", city: "Chicago" },
  { tz: "America/New_York", city: "New York" },
  { tz: "America/Toronto", city: "Toronto" },
  { tz: "America/St_Johns", city: "St John’s" }, // -3:30
  { tz: "America/Argentina/Buenos_Aires", city: "Buenos Aires" },
  { tz: "Atlantic/Azores", city: "Azores" },
  { tz: "Europe/London", city: "London" },       // DST-aware (0 / +1)
  { tz: "Europe/Berlin", city: "Berlin" },       // DST-aware (+1 / +2)
  { tz: "Europe/Athens", city: "Athens" },
  { tz: "Europe/Moscow", city: "Moscow" },
  { tz: "Asia/Tehran", city: "Tehran" },         // +3:30
  { tz: "Asia/Dubai", city: "Dubai" },
  { tz: "Asia/Kabul", city: "Kabul" },           // +4:30
  { tz: "Asia/Karachi", city: "Karachi" },
  { tz: "Asia/Kolkata", city: "Mumbai" },        // +5:30
  { tz: "Asia/Kathmandu", city: "Kathmandu" },   // +5:45
  { tz: "Asia/Dhaka", city: "Dhaka" },
  { tz: "Asia/Yangon", city: "Yangon" },         // +6:30
  { tz: "Asia/Bangkok", city: "Bangkok" },
  { tz: "Asia/Shanghai", city: "Shanghai" },
  { tz: "Asia/Tokyo", city: "Tokyo" },
  { tz: "Australia/Adelaide", city: "Adelaide" },// +9:30 (+10:30 DST)
  { tz: "Australia/Sydney", city: "Sydney" },    // +10 / +11 DST
  { tz: "Australia/Lord_Howe", city: "Lord Howe" }, // +10:30/+11
  { tz: "Pacific/Noumea", city: "Nouméa" },
  { tz: "Pacific/Auckland", city: "Auckland" },
  { tz: "Pacific/Chatham", city: "Chatham Isl." },  // +12:45/+13:45
  { tz: "Pacific/Tongatapu", city: "Nukuʻalofa" },
  { tz: "Pacific/Kiritimati", city: "Kiritimati" },
];

function TimezoneSelect({
  value,
  onChange,
}: {
  value: number;                 // parent still receives a plain offset (hours)
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [tzId, setTzId] = useState<string>(detectLocalTzId());
  const popRef = useClickAway<HTMLDivElement>(() => setOpen(false));
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // compute current row label & offset (DST-aware)
  const currentCity = useMemo(() => {
    const found = TZ_CITIES.find(c => c.tz === tzId);
    return found ?? { tz: "UTC", city: "UTC" };
  }, [tzId]);

  const currentOffset = useMemo(() => offsetHoursFor(currentCity.tz), [currentCity.tz]);
  const pillLabel = `${fmtGMT(currentOffset)} • ${currentCity.city}`;

  // emit offset to parent whenever the tz changes (or at mount)
  useEffect(() => {
    onChange(currentOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOffset]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 240;
    const spaceRight = window.innerWidth - rect.left;
    setAlignRight(spaceRight < menuWidth + 16);
  }, [open]);

  return (
    <div className="relative" ref={popRef}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c0c0c] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04] transition"
        title={currentCity.tz}
      >
        {pillLabel}
        <svg
          className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-2 w-[240px] rounded-2xl border border-white/10 bg-[#0c0c0c]/95 p-2 shadow-2xl backdrop-blur ${
            alignRight ? "right-0" : "left-0"
          }`}
          style={{ maxHeight: 320, overflowY: "auto" }}
        >
          <ul>
            {TZ_CITIES.map((opt) => {
              const off = offsetHoursFor(opt.tz);
              const selected = opt.tz === tzId;
              return (
                <li key={opt.tz}>
                  <button
                    className={`w-full grid grid-cols-[auto_auto] items-center rounded-md px-2 py-1 text-xs hover:bg-white/[0.06] ${
                      selected ? "bg-white/[0.08]" : ""
                    }`}
                    onClick={() => { setTzId(opt.tz); setOpen(false); }}
                    title={opt.tz}
                  >
                    <span className="tabular-nums">{fmtGMT(off)}</span>
                    <span className="justify-self-end truncate">{opt.city}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 pt-2 border-t border-white/10">
            <button
              onClick={() => { setTzId(detectLocalTzId()); }}
              className="w-full rounded-md bg-emerald-600/80 px-2 py-1.5 text-xs text-white hover:bg-emerald-600"
            >
              Use my location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ------------ Country/sector/impact options per your Supabase mapping ------------ */

type CountryRow = { id: number; name: string; code: string; currency: string; currency_symbol: string; url_name: string };
const COUNTRIES_RAW: CountryRow[] = [
  { id: 0,   name: "Worldwide",      code: "WW", currency: "ALL", currency_symbol: "",    url_name: "worldwide" },
  { id: 36,  name: "Australia",      code: "AU", currency: "AUD", currency_symbol: "$",   url_name: "australia" },
  { id: 76,  name: "Brazil",         code: "BR", currency: "BRL", currency_symbol: "R$",  url_name: "brazil" },
  { id: 124, name: "Canada",         code: "CA", currency: "CAD", currency_symbol: "$",   url_name: "canada" },
  { id: 156, name: "China",          code: "CN", currency: "CNY", currency_symbol: "¥",   url_name: "china" },
  { id: 250, name: "France",         code: "FR", currency: "EUR", currency_symbol: "€",   url_name: "france" },
  { id: 276, name: "Germany",        code: "DE", currency: "EUR", currency_symbol: "€",   url_name: "germany" },
  { id: 344, name: "Hong Kong",      code: "HK", currency: "HKD", currency_symbol: "HK$", url_name: "hong-kong" },
  { id: 356, name: "India",          code: "IN", currency: "INR", currency_symbol: "₹",   url_name: "india" },
  { id: 380, name: "Italy",          code: "IT", currency: "EUR", currency_symbol: "€",   url_name: "italy" },
  { id: 392, name: "Japan",          code: "JP", currency: "JPY", currency_symbol: "¥",   url_name: "japan" },
  { id: 410, name: "South Korea",    code: "KR", currency: "KRW", currency_symbol: "₩",   url_name: "south-korea" },
  { id: 484, name: "Mexico",         code: "MX", currency: "MXN", currency_symbol: "Mex$",url_name: "mexico" },
  { id: 554, name: "New Zealand",    code: "NZ", currency: "NZD", currency_symbol: "$",   url_name: "new-zealand" },
  { id: 578, name: "Norway",         code: "NO", currency: "NOK", currency_symbol: "Kr",  url_name: "norway" },
  { id: 702, name: "Singapore",      code: "SG", currency: "SGD", currency_symbol: "R$",  url_name: "singapore" },
  { id: 710, name: "South Africa",   code: "ZA", currency: "ZAR", currency_symbol: "R",   url_name: "south-africa" },
  { id: 724, name: "Spain",          code: "ES", currency: "EUR", currency_symbol: "€",   url_name: "spain" },
  { id: 752, name: "Sweden",         code: "SE", currency: "SEK", currency_symbol: "Kr",  url_name: "sweden" },
  { id: 756, name: "Switzerland",    code: "CH", currency: "CHF", currency_symbol: "₣",   url_name: "switzerland" },
  { id: 826, name: "United Kingdom", code: "GB", currency: "GBP", currency_symbol: "£",   url_name: "united-kingdom" },
  { id: 840, name: "United States",  code: "US", currency: "USD", currency_symbol: "$",   url_name: "united-states" },
  { id: 999, name: "European Union", code: "EU", currency: "EUR", currency_symbol: "€",   url_name: "european-union" },
];

const PREFERRED_TOP_CODES = ["EU","US","GB","JP","CA","AU","NZ","CH","CN"];

function buildCountryOptions(): Option[] {
  const topSet = new Set(PREFERRED_TOP_CODES);
  const top = COUNTRIES_RAW.filter(c => topSet.has(c.code));
  const rest = COUNTRIES_RAW.filter(c => !topSet.has(c.code));
  const byLabel = (a: CountryRow, b: CountryRow) => a.name.localeCompare(b.name);
  const fmt = (c: CountryRow): Option => ({
    value: c.code,
    label: `${c.name} (${c.currency})`,
  });
  return [...top, ...rest.sort(byLabel)].map(fmt);
}

/* ------------ Main component ------------ */
export default function CalendarClient() {
  // defaults: this week
  const defaultStart = useMemo(() => toISO(startOfWeekUTC()), []);
  const defaultEnd = useMemo(() => toISO(endOfWeekUTC()), []);
  const [range, setRange] = useState<Range>({ start: defaultStart, end: defaultEnd });
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  /* ---- Timezone offset (GMT) ---- */
  const [tzOffset, setTzOffset] = useState<number>(() => offsetHoursFor(detectLocalTzId()));


  /* Countries — Supabase mapping, with preferred 9 pinned & preselected */
  const COUNTRY_OPTIONS: Option[] = useMemo(buildCountryOptions, []);
  const [countriesSel, setCountriesSel] = useState<string[]>(PREFERRED_TOP_CODES);

  /* Sectors — full list; empty selection = show all */
  const SECTOR_OPTIONS: Option[] = [
    { value: "None",      label: "None" },
    { value: "Market",    label: "Market" },
    { value: "GDP",       label: "GDP" },
    { value: "Jobs",      label: "Jobs" },
    { value: "Prices",    label: "Prices" },
    { value: "Money",     label: "Money" },
    { value: "Trade",     label: "Trade" },
    { value: "Government",label: "Government" },
    { value: "Business",  label: "Business" },
    { value: "Consumer",  label: "Consumer" },
    { value: "Housing",   label: "Housing" },
    { value: "Taxes",     label: "Taxes" },
    { value: "Holidays",  label: "Holidays" },
  ];
  const [sectorsSel, setSectorsSel] = useState<string[]>([]);

  /* Impact — 0..3; empty = show all */
  const IMPACT_OPTIONS: Option[] = [
    { value: "0", label: "None" },
    { value: "1", label: "Low" },
    { value: "2", label: "Moderate" },
    { value: "3", label: "High" },
  ];
  const [impactSel, setImpactSel] = useState<string[]>([]);

  /* Encode for hook (only include parts that have selections) */
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
    country: encodedCountry, // empty string => no filters used
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
  const [drawer, setDrawer] = useState<{
    open: boolean;
    valueId: number | null;
    eventId: number | string | null;
    eventCode: string | null;
  }>({
    open: false,
    valueId: null,
    eventId: null,
    eventCode: null,
  });

  const handleSelectEvent = (numericEventId: number) => {
    setDrawer({ open: true, valueId: null, eventId: numericEventId, eventCode: null });
  };

  type ExtraIdFields = Partial<{
    event_id: number | string | null;
    eventId: number | string | null;
  }>;
  function handleSelect(row: CalendarEventRow) {
    const extras = row as unknown as ExtraIdFields;
    const valueId = Number(row.id);
    const eventCode = typeof row.event_code === "string" ? row.event_code : null;

    const raw = (extras.event_id ?? extras.eventId ?? null) as number | string | null;
    const n = typeof raw === "number" ? raw : Number(raw);
    const numericEventId = Number.isFinite(n) ? (n as number) : null;

    setDrawer({
      open: true,
      valueId: Number.isFinite(valueId) ? valueId : null,
      eventId: numericEventId ?? (eventCode || null),
      eventCode,
    });
  }

  return (
    <div className="px-4 lg:px-6 pb-6 pt-2">
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
                  onClick={() => setCountriesSel(PREFERRED_TOP_CODES)}
                  className="rounded-md bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                >
                  Top 9 preset
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
        onSelectEvent={handleSelectEvent}
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
        onOpenChange={(open) =>
          setDrawer((s) => ({
            open,
            valueId: open ? s.valueId : null,
            eventId: open ? s.eventId : null,
            eventCode: open ? s.eventCode : null,
          }))
        }
        valueId={drawer.valueId}
        eventId={drawer.eventId}
        eventCode={drawer.eventCode}
      />
    </div>
  );
}
