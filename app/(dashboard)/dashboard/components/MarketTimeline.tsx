"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db/supabase-clients";

type ImpactLevel = 2 | 3;
type RangeMode = "today" | "week";

type UpcomingEvent = {
  id: string;
  eventId: number;
  title: string;
  timeIso: string;
  countryCode: string;
  currency: string;
  importance: ImpactLevel;
};

type RawCalendarRow = {
  id: number;
  event_id: number;
  time: number | string | Date;
  event:
    | {
        id: number | null;
        name: string | null;
        importance: number | null;
        country:
          | {
              code: string | null;
              currency: string | null;
            }
          | {
              code: string | null;
              currency: string | null;
            }[]
          | null;
      }
    | {
        id: number | null;
        name: string | null;
        importance: number | null;
        country:
          | {
              code: string | null;
              currency: string | null;
            }
          | {
              code: string | null;
              currency: string | null;
            }[]
          | null;
      }[]
    | null;
};

const WATCHLIST_STORAGE_KEY = "haydosfx-upcoming-events-watchlist";
const LONDON_TZ = "Europe/London";
const DATE_LOCALE = "en-GB";

function first<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
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
  return Math.floor(new Date(d).getTime() / 1000);
}

function getUtcTodayRange(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    nowIso: now.toISOString(),
  };
}

function getUtcWeekRange(now = new Date()) {
  const start = new Date(now);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    nowIso: now.toISOString(),
  };
}

function formatParts(
  date: Date,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  const parts = new Intl.DateTimeFormat(DATE_LOCALE, {
    ...options,
    timeZone: LONDON_TZ,
  }).formatToParts(date);

  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

function formatClock(iso: string) {
  const p = formatParts(new Date(iso), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${p.hour ?? "--"}:${p.minute ?? "--"}`;
}

function formatShortDay(iso: string) {
  const p = formatParts(new Date(iso), {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return `${p.weekday ?? ""} ${p.day ?? ""} ${p.month ?? ""}`.trim();
}

function formatHeaderDay(nowMs: number) {
  const p = formatParts(new Date(nowMs), {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return `${p.weekday ?? ""} ${p.day ?? ""} ${p.month ?? ""}`.trim();
}

function getTimeUntilLabel(iso: string, nowMs: number) {
  const diffMs = new Date(iso).getTime() - nowMs;
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin <= 0) return "Now";

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;

  if (hours <= 0) return `in ${mins}m`;
  if (mins === 0) return `in ${hours}h`;
  return `in ${hours}h ${mins}m`;
}

function getMinutesUntil(iso: string, nowMs: number) {
  return Math.round((new Date(iso).getTime() - nowMs) / 60000);
}

function impactLabel(importance: ImpactLevel) {
  return importance === 3 ? "High" : "Moderate";
}

function impactClasses(importance: ImpactLevel) {
  if (importance === 3) {
    return {
      dot: "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.55)]",
      pill: "border-rose-400/25 bg-rose-400/10 text-rose-200",
      glow: "from-rose-500/12",
      accent: "bg-rose-400",
      text: "text-rose-200",
      watch: "text-rose-200 border-rose-400/20 bg-rose-400/10",
    };
  }

  return {
    dot: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.45)]",
    pill: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    glow: "from-amber-400/10",
    accent: "bg-amber-300",
    text: "text-amber-100",
    watch: "text-amber-100 border-amber-300/15 bg-amber-300/10",
  };
}

function buildProgressWidth(iso: string, rangeMode: RangeMode, nowMs: number) {
  const target = new Date(iso).getTime();

  if (target <= nowMs) return 100;

  const totalMinutes = rangeMode === "today" ? 24 * 60 : 7 * 24 * 60;
  const diffMinutes = Math.max(0, Math.round((target - nowMs) / 60000));
  const elapsed = totalMinutes - diffMinutes;
  const pct = Math.max(0, Math.min(100, (elapsed / totalMinutes) * 100));

  return pct;
}

function countryCodeToFlag(code?: string) {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌐";
  return String.fromCodePoint(...[...c].map((char) => 127397 + char.charCodeAt(0)));
}

function loadWatchlist(): Set<string> {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set<string>();
  }
}

function saveWatchlist(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([...set]));
}

async function fetchUpcomingEvents(rangeMode: RangeMode): Promise<UpcomingEvent[]> {
  const range = rangeMode === "today" ? getUtcTodayRange() : getUtcWeekRange();

  const { data, error } = await supabase
    .from("calendar_values")
    .select(`
      id,
      event_id,
      time,
      event:calendar_events(
        id,
        name,
        importance,
        country:calendar_countries(
          code,
          currency
        )
      )
    `)
    .gte("time", toEpochSeconds(range.nowIso))
    .lte("time", toEpochSeconds(range.endIso))
    .order("time", { ascending: true })
    .limit(250);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawCalendarRow[];
  const deduped = new Map<string, UpcomingEvent>();

  for (const row of rows) {
    const ev = first(row.event);
    const country = first(ev?.country ?? null);
    const importance = Number(ev?.importance ?? 0);

    if (importance !== 2 && importance !== 3) continue;

    const timeIso = normalizeUtcIso(row.time);
    if (timeIso < range.startIso || timeIso > range.endIso) continue;

    const eventId = Number(ev?.id ?? row.event_id ?? 0);
    const title = String(ev?.name ?? "").trim();
    const countryCode = String(country?.code ?? "").toUpperCase();
    const currency = String(country?.currency ?? "").toUpperCase();
    const key = `${eventId}-${timeIso}`;

    if (!title) continue;
    if (deduped.has(key)) continue;

    deduped.set(key, {
      id: key,
      eventId,
      title,
      timeIso,
      countryCode,
      currency,
      importance: importance as ImpactLevel,
    });
  }

  return [...deduped.values()].sort(
    (a, b) => new Date(a.timeIso).getTime() - new Date(b.timeIso).getTime()
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M10 2.6l2.2 4.47 4.93.72-3.56 3.47.84 4.9L10 13.84l-4.41 2.32.84-4.9L2.87 7.8l4.93-.72L10 2.6z" />
    </svg>
  );
}

export default function UpcomingEvents() {
  const [mounted, setMounted] = useState(false);
  const [rangeMode, setRangeMode] = useState<RangeMode>("today");
  const [items, setItems] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start from a stable value so SSR and client initial render match.
  const [nowTick, setNowTick] = useState(0);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setNowTick(Date.now());
    setWatchlist(loadWatchlist());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const rows = await fetchUpcomingEvents(rangeMode);
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const refresh = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [rangeMode]);

  useEffect(() => {
    if (!mounted) return;

    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [mounted]);

  const displayNowMs = mounted && nowTick > 0 ? nowTick : 0;

  const toggleWatch = (id: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveWatchlist(next);
      return next;
    });
  };

  const sortedItems = useMemo(() => {
    const watched: UpcomingEvent[] = [];
    const normal: UpcomingEvent[] = [];

    for (const item of items) {
      if (watchlist.has(item.id)) watched.push(item);
      else normal.push(item);
    }

    return [...watched, ...normal];
  }, [items, watchlist]);

  const nextHighImpact = useMemo(() => {
    return sortedItems.find((item) => item.importance === 3) ?? null;
  }, [sortedItems]);

  const nextAny = useMemo(() => {
    return sortedItems[0] ?? null;
  }, [sortedItems]);

  const totalHigh = useMemo(() => {
    return sortedItems.filter((item) => item.importance === 3).length;
  }, [sortedItems]);

  const totalModerate = useMemo(() => {
    return sortedItems.filter((item) => item.importance === 2).length;
  }, [sortedItems]);

  const todayCount = useMemo(() => {
    const today =
      displayNowMs > 0
        ? new Date(displayNowMs).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    return sortedItems.filter((item) => item.timeIso.slice(0, 10) === today).length;
  }, [sortedItems, displayNowMs]);

  const watchedCount = useMemo(() => {
    return sortedItems.filter((item) => watchlist.has(item.id)).length;
  }, [sortedItems, watchlist]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, UpcomingEvent[]>();

    for (const item of sortedItems) {
      const key = new Date(item.timeIso).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }

    return [...map.entries()];
  }, [sortedItems]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.13),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(244,114,182,0.08),_transparent_22%),linear-gradient(180deg,#10131d_0%,#090c14_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.34)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Upcoming News & Market Events
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Medium and high impact releases still ahead.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
          {displayNowMs > 0 ? formatHeaderDay(displayNowMs) : "—"}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-stretch">
        <div className="inline-flex self-start rounded-2xl border border-white/10 bg-black/20 p-1">
          <button
            onClick={() => setRangeMode("today")}
            className={`rounded-xl px-3 py-1.5 text-sm transition ${
              rangeMode === "today"
                ? "bg-white/10 text-white shadow-[0_6px_16px_rgba(255,255,255,0.06)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setRangeMode("week")}
            className={`rounded-xl px-3 py-1.5 text-sm transition ${
              rangeMode === "week"
                ? "bg-white/10 text-white shadow-[0_6px_16px_rgba(255,255,255,0.06)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            This Week
          </button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              High
            </div>
            <div className="mt-1 text-lg font-semibold text-white">{totalHigh}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Moderate
            </div>
            <div className="mt-1 text-lg font-semibold text-white">{totalModerate}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Next Event
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {nextAny && displayNowMs > 0
                ? getTimeUntilLabel(nextAny.timeIso, displayNowMs)
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Today Due
            </div>
            <div className="mt-1 text-lg font-semibold text-white">{todayCount}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Watched
            </div>
            <div className="mt-1 text-lg font-semibold text-white">{watchedCount}</div>
          </div>
        </div>
      </div>

      {(nextHighImpact || nextAny) && !loading ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {nextHighImpact ? "Next high impact" : "Next event"}
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xl">
                  {countryCodeToFlag((nextHighImpact ?? nextAny)?.countryCode)}
                </span>
                <div className="text-base font-semibold text-white">
                  {(nextHighImpact ?? nextAny)?.title}
                </div>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {(nextHighImpact ?? nextAny)?.currency || "—"} •{" "}
                {(nextHighImpact ?? nextAny)?.countryCode || "—"} •{" "}
                {nextHighImpact || nextAny
                  ? formatShortDay((nextHighImpact ?? nextAny)!.timeIso)
                  : "—"}{" "}
                •{" "}
                {nextHighImpact || nextAny
                  ? formatClock((nextHighImpact ?? nextAny)!.timeIso)
                  : "—"}
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Countdown
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {nextHighImpact || nextAny
                    ? displayNowMs > 0
                      ? getTimeUntilLabel((nextHighImpact ?? nextAny)!.timeIso, displayNowMs)
                      : "—"
                    : "—"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Impact
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {nextHighImpact ? "High" : nextAny ? impactLabel(nextAny.importance) : "—"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Minutes Away
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {nextHighImpact || nextAny
                    ? displayNowMs > 0
                      ? `${Math.max(
                          0,
                          getMinutesUntil((nextHighImpact ?? nextAny)!.timeIso, displayNowMs)
                        )}m`
                      : "—"
                    : "—"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Watch
                </div>
                <button
                  type="button"
                  onClick={() => nextAny && toggleWatch((nextHighImpact ?? nextAny)!.id)}
                  className={`mt-1 inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs transition ${
                    watchlist.has((nextHighImpact ?? nextAny)?.id ?? "")
                      ? "border-yellow-300/25 bg-yellow-300/10 text-yellow-100"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
                  }`}
                >
                  <StarIcon filled={watchlist.has((nextHighImpact ?? nextAny)?.id ?? "")} />
                  {watchlist.has((nextHighImpact ?? nextAny)?.id ?? "") ? "Watching" : "Watch"}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Event Density
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Load, watchlist and impact mix.
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Total queued</div>
                <div className="text-lg font-semibold text-white">{sortedItems.length}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>High impact</span>
                    <span>
                      {sortedItems.length ? Math.round((totalHigh / sortedItems.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-400"
                      style={{
                        width: `${sortedItems.length ? (totalHigh / sortedItems.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Moderate impact</span>
                    <span>
                      {sortedItems.length
                        ? Math.round((totalModerate / sortedItems.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500"
                      style={{
                        width: `${sortedItems.length ? (totalModerate / sortedItems.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Watchlist</span>
                    <span>
                      {sortedItems.length ? Math.round((watchedCount / sortedItems.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-yellow-300 to-orange-400"
                      style={{
                        width: `${sortedItems.length ? (watchedCount / sortedItems.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Quick Watchlist
                </div>
                <div className="mt-3 space-y-2">
                  {sortedItems.filter((item) => watchlist.has(item.id)).slice(0, 4).length === 0 ? (
                    <div className="text-xs text-slate-500">
                      Star events to pin them at the top.
                    </div>
                  ) : (
                    sortedItems
                      .filter((item) => watchlist.has(item.id))
                      .slice(0, 4)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-white">
                              {item.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {item.currency} • {formatClock(item.timeIso)}
                            </div>
                          </div>
                          <div className="text-lg">{countryCodeToFlag(item.countryCode)}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 grid gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="animate-pulse rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-1/3 rounded bg-white/10" />
                <div className="h-4 w-20 rounded bg-white/10" />
              </div>
              <div className="mt-3 h-3 w-2/3 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
          <div className="text-2xl">📰</div>
          <div className="mt-2 text-sm font-medium text-slate-200">
            No medium or high impact events ahead
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {rangeMode === "today"
              ? "You are clear for the rest of today."
              : "Nothing material left this week."}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {groupedItems.map(([dayKey, dayItems]) => (
            <div key={dayKey}>
              {rangeMode === "week" ? (
                <div className="mb-2 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/8" />
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    {formatShortDay(dayItems[0].timeIso)}
                  </div>
                  <div className="h-px flex-1 bg-white/8" />
                </div>
              ) : null}

              <div className="space-y-2">
                {dayItems.slice(0, rangeMode === "today" ? 10 : 30).map((item) => {
                  const styles = impactClasses(item.importance);
                  const progressWidth = buildProgressWidth(
                    item.timeIso,
                    rangeMode,
                    displayNowMs || Date.now()
                  );
                  const isWatched = watchlist.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] transition hover:border-white/15 hover:bg-white/[0.05]"
                    >
                      <div
                        className={`pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r ${styles.glow} to-transparent`}
                      />

                      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex min-w-[28px] flex-col items-center">
                              <span className="text-lg leading-none">
                                {countryCodeToFlag(item.countryCode)}
                              </span>
                              <span className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                {item.countryCode || item.currency || "EV"}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${styles.pill}`}
                                >
                                  {impactLabel(item.importance)}
                                </span>

                                {item.currency ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-300">
                                    {item.currency}
                                  </span>
                                ) : null}

                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                  {formatShortDay(item.timeIso)}
                                </span>

                                {isWatched ? (
                                  <span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-yellow-100">
                                    Watched
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-2 text-sm font-semibold text-white">
                                {item.title}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span>{formatClock(item.timeIso)}</span>
                                <span className="text-slate-600">•</span>
                                <span>{item.countryCode || "—"}</span>
                                <span className="text-slate-600">•</span>
                                <span>{item.currency || "—"}</span>
                                <span className="text-slate-600">•</span>
                                <span>
                                  {displayNowMs > 0 ? getTimeUntilLabel(item.timeIso, displayNowMs) : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-white/8 px-4 py-3 xl:border-l xl:border-t-0">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                Countdown
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {displayNowMs > 0 ? getTimeUntilLabel(item.timeIso, displayNowMs) : "—"}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                Minutes
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {displayNowMs > 0
                                  ? Math.max(0, getMinutesUntil(item.timeIso, displayNowMs))
                                  : "—"}
                                {displayNowMs > 0 ? "m" : ""}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleWatch(item.id)}
                              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs transition ${
                                isWatched
                                  ? styles.watch
                                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
                              }`}
                              title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                            >
                              <StarIcon filled={isWatched} />
                              {isWatched ? "Watch" : "Pin"}
                            </button>
                          </div>

                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-500">
                              <span>Timeline</span>
                              <span>{impactLabel(item.importance)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5">
                              <div
                                className={`h-1.5 rounded-full ${styles.accent}`}
                                style={{ width: `${progressWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}