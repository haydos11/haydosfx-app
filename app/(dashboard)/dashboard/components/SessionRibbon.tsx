"use client";

import * as React from "react";

type EventKind = "open" | "fix" | "news" | "other";

type RibbonEvent = {
  label: string;
  timeLocal: string; // "HH:MM" Europe/London
  kind?: EventKind;
};

type SegmentKey = "asia" | "europe" | "us" | "late";

type SessionSegment = {
  key: SegmentKey;
  label: string;
  start: string; // "HH:MM" London
  end: string;   // "HH:MM" London
};

type WindowBlock = {
  label: string;
  start: string;
  end: string;
  className: string;
};

function hhmmToMin(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);

  const hh = h === 24 ? 24 : Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;

  return hh * 60 + mm;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function getLondonNowMin() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const hour = Number(parts.hour ?? "0");
  const minute = Number(parts.minute ?? "0");
  return hour * 60 + minute;
}

function isLondonDST() {
  const z = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "short",
  }).format(new Date());
  return z.includes("BST");
}

function formatCountdown(deltaMin: number) {
  const h = Math.floor(deltaMin / 60);
  const m = deltaMin % 60;
  return `${h}h ${m}m`;
}

function kindDot(kind: EventKind | undefined) {
  switch (kind) {
    case "open":
      return "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.35)]";
    case "fix":
      return "bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.35)]";
    case "news":
      return "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)]";
    default:
      return "bg-white/55 shadow-[0_0_14px_rgba(255,255,255,0.18)]";
  }
}

function segmentBarClass(key: SegmentKey) {
  switch (key) {
    case "asia":
      return "bg-blue-500/25 shadow-[0_0_22px_rgba(59,130,246,0.20)]";
    case "europe":
      return "bg-emerald-500/20 shadow-[0_0_22px_rgba(16,185,129,0.20)]";
    case "us":
      return "bg-rose-500/20 shadow-[0_0_22px_rgba(244,63,94,0.20)]";
    case "late":
    default:
      return "bg-violet-500/15 shadow-[0_0_22px_rgba(167,139,250,0.18)]";
  }
}

function segmentLabelClass(key: SegmentKey) {
  switch (key) {
    case "asia":
      return "text-blue-200/70";
    case "europe":
      return "text-emerald-200/70";
    case "us":
      return "text-rose-200/70";
    case "late":
    default:
      return "text-violet-200/60";
  }
}

export default function SessionRibbon() {
  const DST = isLondonDST();

  const START_MIN = 0;
  const END_MIN = 1440;
  const SPAN = END_MIN - START_MIN;

  const segments: SessionSegment[] = [
    { key: "asia", label: "Asia", start: "00:00", end: "07:00" },
    { key: "europe", label: "London", start: "07:00", end: "13:30" },
    { key: "us", label: "New York", start: "13:30", end: "22:00" },
    { key: "late", label: "Late", start: "22:00", end: "24:00" },
  ];

  // Yellow block for "Euro Open" window (Frankfurt -> London open)
  const windows: WindowBlock[] = [
    {
      label: "Euro Open",
      start: "07:00",
      end: "08:00",
      className:
        "bg-yellow-400/18 shadow-[0_0_22px_rgba(250,204,21,0.18)]",
    },
  ];

  const events: RibbonEvent[] = [
    { label: "Tokyo Fix", timeLocal: "00:55", kind: "fix" },
    { label: "Frankfurt Open", timeLocal: "07:00", kind: "open" },
    { label: "London Open", timeLocal: "08:00", kind: "open" },
    { label: "COMEX Open", timeLocal: "13:20", kind: "open" },
    { label: "US Data Window", timeLocal: "13:30", kind: "news" },
    { label: "NYSE Open", timeLocal: "14:30", kind: "open" },
    { label: "London Fix", timeLocal: "16:00", kind: "fix" },
    { label: "US Cash Close", timeLocal: "21:00", kind: "other" },
  ];

  const [nowMin, setNowMin] = React.useState<number>(() => getLondonNowMin());

  React.useEffect(() => {
    const t = setInterval(() => setNowMin(getLondonNowMin()), 15_000);
    return () => clearInterval(t);
  }, []);

  const nowPct = clamp((nowMin / SPAN) * 100, 0, 100);

  const activeSeg = React.useMemo(() => {
    const m = nowMin;
    for (const s of segments) {
      const a = hhmmToMin(s.start);
      const b = hhmmToMin(s.end);
      if (m >= a && m < b) return s;
    }
    return segments[segments.length - 1];
  }, [nowMin, segments]);

  const nextEvent = React.useMemo(() => {
    const sorted = [...events]
      .map((e) => ({ ...e, min: hhmmToMin(e.timeLocal) }))
      .sort((a, b) => a.min - b.min);

    const later = sorted.find((e) => e.min > nowMin);
    if (later) return { ...later, delta: later.min - nowMin, tomorrow: false };

    const first = sorted[0];
    return { ...first, delta: (1440 - nowMin) + first.min, tomorrow: true };
  }, [events, nowMin]);

  return (
    <div className="bg-zinc-900 p-4 rounded-xl">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Market Timeline</h2>
          <span className="text-xs text-white/50">
            London {DST ? "DST (BST)" : "Standard (GMT)"}
          </span>
        </div>

        <div className="text-xs text-white/60">
          Current:{" "}
          <span className={`font-medium ${segmentLabelClass(activeSeg.key)}`}>
            {activeSeg.label}
          </span>
        </div>
      </div>

      <div className="relative">
        {/* IMPORTANT: overflow-visible so tooltips aren't clipped */}
        <div className="relative h-16 rounded-lg bg-black/30 border border-white/10 overflow-visible">
          {/* Base track */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-gradient-to-r from-violet-500/25 via-fuchsia-500/25 to-rose-500/25" />

          {/* Session segment overlays */}
          {segments.map((s) => {
            const left = (hhmmToMin(s.start) / SPAN) * 100;
            const right = (hhmmToMin(s.end) / SPAN) * 100;
            const w = Math.max(0, right - left);

            return (
              <div
                key={s.key}
                className={`absolute top-1/2 -translate-y-1/2 h-[7px] rounded-full ${segmentBarClass(
                  s.key
                )}`}
                style={{
                  left: `calc(${left}% + 16px)`,
                  width: `calc(${w}% - 32px)`,
                }}
              />
            );
          })}

          {/* Extra window blocks (Euro Open in yellow) */}
          {windows.map((w) => {
            const left = (hhmmToMin(w.start) / SPAN) * 100;
            const right = (hhmmToMin(w.end) / SPAN) * 100;
            const width = Math.max(0, right - left);

            return (
              <div
                key={w.label}
                className={`absolute top-1/2 -translate-y-1/2 h-[9px] rounded-full ${w.className}`}
                style={{
                  left: `calc(${left}% + 16px)`,
                  width: `calc(${width}% - 32px)`,
                }}
                title={`${w.label} • ${w.start}–${w.end} London`}
              />
            );
          })}

          {/* Segment labels */}
          <div className="absolute left-4 right-4 top-2 flex justify-between text-[11px]">
            <span className={segmentLabelClass("asia")}>Asia</span>
            <span className={segmentLabelClass("europe")}>London</span>
            <span className={segmentLabelClass("us")}>New York</span>
            <span className={segmentLabelClass("late")}>Late</span>
          </div>

          {/* Boundary ticks */}
          {segments.map((s) => {
            const pct = (hhmmToMin(s.start) / SPAN) * 100;
            return (
              <div
                key={`${s.key}-tick`}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `calc(${pct}% + 16px)` }}
              >
                <div className="h-7 w-px bg-white/12" />
              </div>
            );
          })}

          {/* Events with tooltips */}
          {events.map((e) => {
            const min = hhmmToMin(e.timeLocal);
            const pct = (min / SPAN) * 100;

            return (
              <div
                key={`${e.label}-${e.timeLocal}`}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `calc(${pct}% + 16px)` }}
              >
                {/* Hover target */}
                <div className="relative group">
                  <div className={`h-2.5 w-2.5 rounded-full ${kindDot(e.kind)}`} />

                  {/* Tooltip content */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="whitespace-nowrap rounded-md bg-black/95 border border-white/15 px-2 py-1 text-[11px] text-white shadow-lg">
                      <div className="font-medium">{e.label}</div>
                      <div className="text-white/60">{e.timeLocal} London</div>
                    </div>
                    <div className="mx-auto mt-[-3px] h-2 w-2 rotate-45 bg-black/95 border-r border-b border-white/15" />
                  </div>

                  {/* time label under dot */}
                  <div className="mt-2 text-[10px] text-white/55 whitespace-nowrap -translate-x-1/2 relative left-1/2">
                    {e.timeLocal}
                  </div>
                </div>
              </div>
            );
          })}

          {/* NOW marker */}
          <div
            className="absolute top-0 bottom-0"
            style={{ left: `calc(${nowPct}% + 16px)` }}
          >
            <div className="absolute top-0 bottom-0 w-px bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.25)]" />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.35)]" />
          </div>

          {/* Handles (visual) */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border border-white/20 bg-black shadow-[0_0_18px_rgba(167,139,250,0.20)]" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border border-white/20 bg-black shadow-[0_0_18px_rgba(244,63,94,0.18)]" />
        </div>

        {/* Next event row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
          <span className="text-white/55">Next event:</span>
          <span className="text-white font-medium">{nextEvent.label}</span>
          <span className="text-white/45">({nextEvent.timeLocal} London)</span>
          <span className="text-white/35">•</span>
          <span className="text-white/80">in {formatCountdown(nextEvent.delta)}</span>
          {nextEvent.tomorrow ? <span className="text-white/45">(tomorrow)</span> : null}
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Open
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> Fix
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> News
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400" /> Euro open
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white" /> Now
          </span>
        </div>
      </div>
    </div>
  );
}