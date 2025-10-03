// app/(dashboard)/calendar/components/CalendarTable.tsx
"use client";

import * as React from "react";
import type { CalendarEventRow } from "../types";
import { Icon } from "@iconify/react";

type Props = {
  items: CalendarEventRow[];
  loading?: boolean;
  error?: string | null;
  /** UTC offset in hours (can be fractional like 9.5) */
  timeOffsetHours?: number;
  /** Optional row click handler (e.g., open details drawer with the full row) */
  onSelect?: (row: CalendarEventRow) => void;
  /** Preferred: callback with the event_id to open the drawer */
  onSelectEvent?: (eventId: number) => void;
};

/* ---------- helper types ---------- */
type Multiplierish = {
  multiplier?: number | null;
  scale?: number | null;
  unit_multiplier?: number | null;
  multiplier_power?: number | null;
};
type Unitish = { unit?: string | null };
type Countryish = { country?: string | null };
type WithRevisedPrev = {
  revised_previous?: number | null;
  revised_previous_num?: number | null;
  revised_prev_value?: number | null;
  previous_revised?: number | null;
  prev_revised?: number | null;
};

type EnrichedRow = CalendarEventRow &
  Partial<Multiplierish & Unitish & Countryish & WithRevisedPrev>;

/* ---------------- helpers: time with UTC offset ---------------- */
const HOURS_MS = 3600_000;

const shiftByOffset = (dt: string | number | Date, offsetH: number): Date =>
  new Date(new Date(dt).getTime() + offsetH * HOURS_MS);

function isLondonDSTNow(): boolean {
  try {
    const part =
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        timeZoneName: "short",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || "";
    return /BST/i.test(part);
  } catch {
    return false;
  }
}

/** Format e.g. 9.5 -> "UTC+9:30", -3.5 -> "UTC−3:30" */
function formatUtcOffset(val: number): string {
  const sign = val >= 0 ? "+" : "−";
  const abs = Math.abs(val);
  const hours = Math.floor(abs);
  const mins = Math.round((abs - hours) * 60);
  return `UTC${sign}${hours}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

/** YYYY-MM-DD key computed after applying offset */
const toShiftedDayKey = (dt: string | number | Date, offsetH: number): string => {
  const d = shiftByOffset(dt, offsetH);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // pseudo-UTC but for shifted clock
};

/** HH:MM after applying offset */
const fmtTimeOffset = (dt: string | number | Date, offsetH: number): string => {
  const d = shiftByOffset(dt, offsetH);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/* ---------------- helpers: flags ---------------- */
function flagIcon(code?: string | null): React.ReactNode {
  if (!code) return null;
  const cc = code.trim().toLowerCase();
  if (cc === "eu" || cc === "ea") return <Icon icon="circle-flags:eu" className="h-5 w-5" />;
  if (cc === "uk" || cc === "gb") return <Icon icon="circle-flags:gb" className="h-5 w-5" />;
  if (cc.length === 2) return <Icon icon={`circle-flags:${cc}`} className="h-5 w-5" />;
  return null;
}

/* ---------------- helpers: units & multipliers ---------------- */
function extractPower(row?: Multiplierish | null): number | null {
  const raw =
    row?.multiplier ??
    row?.scale ??
    row?.unit_multiplier ??
    row?.multiplier_power ??
    null;

  if (!isNum(raw)) return null;

  // Accept direct power values
  if (raw === 0 || raw === 3 || raw === 6 || raw === 9 || raw === 12) return raw;

  // If value is 1e3, 1e6, etc., infer the power.
  const log10 = Math.log10(raw);
  if (Number.isFinite(log10) && Math.abs(Math.round(log10) - log10) < 1e-9) {
    const p = Math.round(log10);
    if ([0, 3, 6, 9, 12].includes(p)) return p;
  }
  return null;
}

function suffixForPower(power: number): "" | "K" | "M" | "B" | "T" {
  return power === 12 ? "T" : power === 9 ? "B" : power === 6 ? "M" : power === 3 ? "K" : "";
}

function autoAbbrevPower(v: number): 0 | 3 | 6 | 9 | 12 {
  const abs = Math.abs(v);
  if (abs >= 1e12) return 12;
  if (abs >= 1e9) return 9;
  if (abs >= 1e6) return 6;
  if (abs >= 1e3) return 3;
  return 0;
}

const isPercentUnit = (u?: string | null): boolean =>
  !!u && ["%", "percent", "percentage", "pct"].includes(u.trim().toLowerCase());

const isCurrencyCode = (u?: string | null): boolean =>
  !!u && /^[A-Z]{3}$/.test(u?.trim() ?? "");

// Format number with multiplier + unit (currency codes hidden)
function fmtValue(v?: number | null, unit?: string | null, row?: Multiplierish | null): string {
  if (!isNum(v)) return "—";
  const expFromRow = extractPower(row);
  const exp = (expFromRow ?? autoAbbrevPower(v)) as 0 | 3 | 6 | 9 | 12;
  const scaled = exp ? v / Math.pow(10, exp) : v;
  const suffix = suffixForPower(exp);
  const abs = Math.abs(scaled);
  const dp = abs < 1 ? 2 : abs < 100 ? 1 : 0;
  let out = scaled.toFixed(dp);
  if (suffix) out += suffix;
  if (isPercentUnit(unit)) return `${out}%`;
  if (isCurrencyCode(unit)) return out; // hide currency code in display
  if (unit && unit !== "—") return `${out} ${unit}`;
  return out;
}

/* ---------------- micro-UI ---------------- */
function impactBadge(
  imp?: number | null
): { label: "" | "High" | "Moderate" | "Low"; cls: string } {
  if (imp == null) return { label: "", cls: "" };
  if (imp >= 3) return { label: "High", cls: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30" };
  if (imp === 2)
    return { label: "Moderate", cls: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30" };
  return { label: "Low", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" };
}

function deviationPill(actual?: number | null, forecast?: number | null): React.ReactNode {
  if (!isNum(actual) || !isNum(forecast) || forecast === 0) return null;
  const pct = ((actual - forecast) / Math.abs(forecast)) * 100;
  const up = pct > 0;
  const tone = up
    ? "text-emerald-300 ring-emerald-500/25 bg-emerald-600/10"
    : "text-rose-300 ring-rose-500/25 bg-rose-600/10";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ${tone}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

function arrow(
  actual?: number | null,
  forecast?: number | null
): { glyph: "" | "↑" | "↓"; cls: string } {
  if (!isNum(actual)) return { glyph: "", cls: "" };
  const up = isNum(forecast) ? actual > forecast : actual > 0;
  return up ? { glyph: "↑", cls: "text-emerald-300" } : { glyph: "↓", cls: "text-rose-300" };
}

/* ---------------- event id resolver (no ts-comments) ---------------- */
type IdFields = Partial<{
  event_id: number | string | null;
  eventCode: number | string | null;
  event: number | string | null;
  event_code: number | string | null;
  eventId: number | string | null;
}>;

function resolveEventId(row: CalendarEventRow): number | null {
  const r = row as unknown as IdFields;
  const maybe =
    r.event_id ??
    r.eventCode ??
    r.event ??
    r.event_code ??
    r.eventId ??
    null;

  const n =
    typeof maybe === "number"
      ? maybe
      : typeof maybe === "string"
      ? Number(maybe)
      : NaN;

  return Number.isFinite(n) ? (n as number) : null;
}

/* ----- no JSX namespace: typed to React.ReactElement ----- */
function PreviousWithRevision(props: {
  prev?: number | null;
  revised?: number | null;
  unit?: string | null;
  row?: Multiplierish | null;
}): React.ReactElement {
  const { prev, revised, unit, row } = props;
  const hasPrev = isNum(prev);
  const hasRevised = isNum(revised);
  if (!hasPrev && !hasRevised) return <>—</>;

  if (!hasRevised || (prev as number) === (revised as number)) {
    return <span className="tabular-nums">{fmtValue(prev as number, unit, row ?? null)}</span>;
  }

  const delta = (revised as number) - (prev as number);
  const up = delta > 0;
  const tone = up
    ? "text-emerald-300 ring-emerald-500/25 bg-emerald-600/10"
    : "text-rose-300 ring-rose-500/25 bg-rose-600/10";

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">{fmtValue(prev as number, unit, row ?? null)}</span>
      <span className="text-slate-500">→</span>
      <span className="tabular-nums">{fmtValue(revised as number, unit, row ?? null)}</span>
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ring-1 ${tone}`}>
        {up ? "▲" : "▼"} {up ? "+" : ""}
        {fmtValue(delta, unit, row ?? null)}
      </span>
    </div>
  );
}

/* ---------------- component ---------------- */
export default function CalendarTable({
  items,
  loading,
  error,
  timeOffsetHours = 0,
  onSelect,
  onSelectEvent,
}: Props): React.ReactElement {
  if (loading) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4 text-sm text-slate-300">
        Loading calendar…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }
  if (!items?.length) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4 text-sm text-slate-300">
        No events found for the selected range.
      </div>
    );
  }

  // group by shifted day (UTC + timeOffsetHours)
  const groups = items.reduce<Record<string, CalendarEventRow[]>>((acc, row) => {
    const key = toShiftedDayKey(row.occurs_at, timeOffsetHours);
    (acc[key] ||= []).push(row);
    return acc;
  }, {});
  const dayKeys = Object.keys(groups).sort();

  const tzSuffix = formatUtcOffset(timeOffsetHours);
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tag = viewerZone === "Europe/London" ? (isLondonDSTNow() ? "BST" : "GMT") : null;
  const tzHeader = `${tzSuffix}${tag ? ` • ${tag}` : ""}`;

  return (
    <div className="mt-6 w-full overflow-hidden rounded-3xl border border-white/10 ring-1 ring-white/5 bg-[#0b0b0b]/70 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/30 to-emerald-500/30" />
      <div className="max-h-[72vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#0b0b0b]/80 backdrop-blur text-slate-400 border-b border-white/10">
            <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:font-medium">
              <th className="w-[84px]">Time ({tzHeader})</th>
              <th className="w-[110px]">Country</th>
              <th>Event</th>
              <th className="w-[92px]">Impact</th>
              <th className="w-[132px]">Actual</th>
              <th className="w-[120px] hidden md:table-cell">Forecast</th>
              <th className="w-[240px] hidden md:table-cell">Previous</th>
              <th className="w-[104px] hidden sm:table-cell">Deviation</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-white/[0.02]">
            {dayKeys.map((day) => (
              <React.Fragment key={day}>
                {/* Day divider row (render using shifted day key) */}
                <tr className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
                  <td colSpan={8} className="px-3 py-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400" />
                      <span className="font-semibold text-slate-200">
                        {new Date(day + "T00:00:00Z").toUTCString().slice(0, 16)}
                      </span>
                      <span className="text-slate-500">• {tzHeader}</span>
                    </div>
                  </td>
                </tr>

                {[...groups[day]]
                  .sort(
                    (a, b) =>
                      shiftByOffset(a.occurs_at, timeOffsetHours).getTime() -
                      shiftByOffset(b.occurs_at, timeOffsetHours).getTime()
                  )
                  .map((row) => {
                    const e = row as EnrichedRow;
                    const imp = impactBadge(e.importance ?? null);
                    const arr = arrow(e.actual ?? null, e.forecast ?? null);
                    const dev = deviationPill(e.actual ?? null, e.forecast ?? null);
                    const unit = e.unit ?? null;
                    const revisedPrev: number | null =
                      e.revised_previous ??
                      e.revised_previous_num ??
                      e.revised_prev_value ??
                      e.previous_revised ??
                      e.prev_revised ??
                      null;

                    // Resolve the event id for the drawer
                    const eventId = resolveEventId(e);
                    const handleClick = () => {
                      if (eventId != null && onSelectEvent) {
                        onSelectEvent(eventId); // preferred: pass event_id
                      } else {
                        onSelect?.(e); // fallback: pass the whole row
                      }
                    };

                    return (
                      <tr
                        key={e.id}
                        onClick={handleClick}
                        className="group cursor-pointer border-t border-white/10 hover:bg-white/[0.04] transition-colors"
                        title={eventId == null ? "No event_id on this row" : `event_id=${eventId}`}
                        data-event-id={eventId ?? undefined}
                      >
                        <td className="px-3 py-3 tabular-nums text-slate-200">
                          {fmtTimeOffset(e.occurs_at, timeOffsetHours)}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {flagIcon(e.country)}
                            <span className="font-medium text-slate-200">{e.country}</span>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="max-w-[56rem] truncate text-slate-100" title={e.title}>
                            {e.title}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          {imp.label ? (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ring-1 ${imp.cls}`}
                            >
                              {imp.label}
                            </span>
                          ) : null}
                        </td>

                        <td className="px-3 py-3">
                          {isNum(e.actual) ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-base leading-none ${arr.cls}`}>{arr.glyph}</span>
                              <span className="tabular-nums text-slate-100">
                                {fmtValue(e.actual, unit, e)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="hidden px-3 py-3 tabular-nums text-slate-200 md:table-cell">
                          {isNum(e.forecast) ? fmtValue(e.forecast, unit, e) : "—"}
                        </td>

                        <td className="hidden px-3 py-3 md:table-cell">
                          <PreviousWithRevision prev={e.previous} revised={revisedPrev} unit={unit} row={e} />
                        </td>

                        <td className="hidden px-3 py-3 sm:table-cell">
                          {dev ?? <span className="text-slate-500">—</span>}
                        </td>
                      </tr>
                    );
                  })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
