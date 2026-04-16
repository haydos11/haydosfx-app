"use client";

import * as React from "react";
import clsx from "clsx";

type GaugeZone = {
  key: string;
  min: number;
  max: number;
  label: string;
  color: string;
  tooltip: string;
};

type VisualSegment = {
  key: string;
  min: number;
  max: number;
  color: string;
};

type TrendPoint = {
  ts: string;
  score: number;
};

type TrendRangeKey = "24h" | "48h" | "72h" | "1w";
type ViewMode = "gauge" | "trend";

type RiskSentimentGaugeProps = {
  score: number;
  className?: string;
  history?: Partial<Record<TrendRangeKey, TrendPoint[]>>;
  defaultView?: ViewMode;
  defaultRange?: TrendRangeKey;
  summaryTitle?: string;
  summaryText?: string;
};

const ZONES: GaugeZone[] = [
  {
    key: "defensive",
    min: 0,
    max: 20,
    label: "Defensive",
    color: "#991b1b",
    tooltip:
      "Defensive conditions usually favour safe havens, stronger vol, heavier caution, and weaker beta participation.",
  },
  {
    key: "cautious",
    min: 20,
    max: 40,
    label: "Cautious",
    color: "#ea580c",
    tooltip:
      "Cautious conditions can allow selective pro-risk trades, but broad continuation is still vulnerable.",
  },
  {
    key: "mixed",
    min: 40,
    max: 60,
    label: "Mixed",
    color: "#d4a017",
    tooltip:
      "Mixed conditions mean cross-asset confirmation is incomplete. Selectivity matters more than conviction.",
  },
  {
    key: "constructive",
    min: 60,
    max: 80,
    label: "Constructive",
    color: "#16a34a",
    tooltip:
      "Constructive conditions support selective pro-risk continuation, especially in the clearest leading sleeves.",
  },
  {
    key: "aggressive-risk-on",
    min: 80,
    max: 100,
    label: "Aggressive Risk-Taking",
    color: "#10b981",
    tooltip:
      "Aggressive risk-taking tends to align with strong equity, carry, and cyclical participation across the tape.",
  },
];

const VISUAL_SEGMENTS: VisualSegment[] = [
  { key: "s1", min: 0, max: 12.5, color: "#8f1d1d" },
  { key: "s2", min: 12.5, max: 25, color: "#b13a12" },
  { key: "s3", min: 25, max: 37.5, color: "#c76814" },
  { key: "s4", min: 37.5, max: 50, color: "#d4a017" },
  { key: "s5", min: 50, max: 62.5, color: "#a5ad31" },
  { key: "s6", min: 62.5, max: 75, color: "#51a548" },
  { key: "s7", min: 75, max: 87.5, color: "#16a34a" },
  { key: "s8", min: 87.5, max: 100, color: "#10b981" },
];

const RANGE_LABELS: Record<TrendRangeKey, string> = {
  "24h": "24H",
  "48h": "48H",
  "72h": "72H",
  "1w": "1W",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function zoneForScore(score: number) {
  const s = clamp(score, 0, 100);
  return (
    ZONES.find((zone) => s >= zone.min && (s < zone.max || zone.max === 100)) ?? ZONES[2]
  );
}

function scoreToLabel(score: number) {
  return zoneForScore(score).label;
}

function scoreToTooltip(score: number) {
  return zoneForScore(score).tooltip;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Upper semicircle in SVG:
 * 0   => 180deg (left)
 * 100 => 360deg (right)
 */
function scoreToAngle(score: number) {
  return 180 + clamp(score, 0, 100) * 1.8;
}

function upperArcRingPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polar(cx, cy, outerR, startAngle);
  const outerEnd = polar(cx, cy, outerR, endAngle);
  const innerEnd = polar(cx, cy, innerR, endAngle);
  const innerStart = polar(cx, cy, innerR, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function makeFallbackSeries(score: number, range: TrendRangeKey): TrendPoint[] {
  const counts: Record<TrendRangeKey, number> = {
    "24h": 12,
    "48h": 16,
    "72h": 18,
    "1w": 24,
  };

  const n = counts[range];
  const base = clamp(score, 0, 100);
  const arr: TrendPoint[] = [];

  for (let i = 0; i < n; i += 1) {
    const drift = (i / Math.max(1, n - 1) - 0.5) * 12;
    const wave =
      Math.sin(i * 0.75) * 5 +
      Math.cos(i * 0.42) * 3 +
      Math.sin(i * 0.2 + 1.4) * 2;
    const value = clamp(Math.round(base - 5 + drift + wave), 8, 94);

    arr.push({
      ts: `${i}`,
      score: value,
    });
  }

  arr[n - 1] = { ts: `${n - 1}`, score: base };
  return arr;
}

function buildLinePath(points: { x: number; y: number }[], smooth = 0.18) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) * smooth;
    const cp1y = p1.y + (p2.y - p0.y) * smooth;
    const cp2x = p2.x - (p3.x - p1.x) * smooth;
    const cp2y = p2.y - (p3.y - p1.y) * smooth;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

function buildAreaPath(points: { x: number; y: number }[], baseY: number) {
  if (points.length < 2) return "";
  const line = buildLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

function TrendChart({
  points,
  score,
}: {
  points: TrendPoint[];
  score: number;
}) {
  const width = 320;
  const height = 164;
  const left = 18;
  const right = 16;
  const top = 18;
  const bottom = 24;
  const innerW = width - left - right;
  const innerH = height - top - bottom;

  const safe = points.length > 1 ? points : makeFallbackSeries(score, "24h");

  const plotted = safe.map((p, i) => {
    const x = left + (i / Math.max(1, safe.length - 1)) * innerW;
    const y = top + (1 - clamp(p.score, 0, 100) / 100) * innerH;
    return { x, y, score: p.score };
  });

  const linePath = buildLinePath(plotted);
  const areaPath = buildAreaPath(plotted, top + innerH);
  const last = plotted[plotted.length - 1];
  const delta =
    safe.length >= 2 ? safe[safe.length - 1].score - safe[0].score : 0;

  const deltaColor =
    delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#cbd5e1";

  const zoneLines = [20, 40, 60, 80].map((level) => ({
    level,
    y: top + (1 - level / 100) * innerH,
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[164px] w-full overflow-visible">
      <defs>
        <linearGradient id="trendAreaClean" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.20)" />
          <stop offset="55%" stopColor="rgba(59,130,246,0.06)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.00)" />
        </linearGradient>

        <linearGradient id="trendLineClean" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="38%" stopColor="#eab308" />
          <stop offset="70%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        <filter id="trendGlowClean" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {zoneLines.map((line) => (
        <line
          key={line.level}
          x1={left}
          y1={line.y}
          x2={width - right}
          y2={line.y}
          stroke="rgba(255,255,255,0.08)"
          strokeDasharray="4 6"
          strokeWidth="1"
        />
      ))}

      <path d={areaPath} fill="url(#trendAreaClean)" />
      <path
        d={linePath}
        fill="none"
        stroke="url(#trendLineClean)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#trendGlowClean)"
      />

      <circle
        cx={last.x}
        cy={last.y}
        r="5.5"
        fill="#ffffff"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="1.2"
        filter="url(#trendGlowClean)"
      />

      <text
        x={width - right}
        y={16}
        textAnchor="end"
        fill={deltaColor}
        style={{ fontSize: "12px", fontWeight: 700 }}
      >
        {delta > 0 ? `+${delta}` : `${delta}`}
      </text>
    </svg>
  );
}

export default function RiskSentimentGauge({
  score,
  className,
  history,
  defaultView = "gauge",
  defaultRange = "24h",
  summaryTitle = "Risk tone remains cautious.",
  summaryText = "Markets are showing selective pro-risk participation, but broader confirmation is still incomplete. Trade selection matters more than conviction until leadership improves.",
}: RiskSentimentGaugeProps) {
  const safeScore = Math.round(clamp(score, 0, 100));
  const [hoveredZoneKey, setHoveredZoneKey] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ViewMode>(defaultView);
  const [range, setRange] = React.useState<TrendRangeKey>(defaultRange);

  const activeZone = React.useMemo(() => {
    if (hoveredZoneKey) {
      return ZONES.find((zone) => zone.key === hoveredZoneKey) ?? zoneForScore(safeScore);
    }
    return zoneForScore(safeScore);
  }, [hoveredZoneKey, safeScore]);

  const trendSeries = React.useMemo(() => {
    const fromProps = history?.[range];
    if (fromProps && fromProps.length > 1) return fromProps;
    return makeFallbackSeries(safeScore, range);
  }, [history, range, safeScore]);

  const trendDelta =
    trendSeries.length > 1
      ? trendSeries[trendSeries.length - 1].score - trendSeries[0].score
      : 0;

  const trendSummary =
    trendDelta > 6
      ? "Risk conditions have improved materially over the selected window."
      : trendDelta > 1
      ? "Risk conditions are improving, but the move is still moderate."
      : trendDelta < -6
      ? "Risk conditions have deteriorated materially over the selected window."
      : trendDelta < -1
      ? "Risk conditions are softening across the selected window."
      : "Risk conditions are broadly range-bound across the selected window.";

  const cx = 160;
  const cy = 170;
  const outerR = 104;
  const innerR = 82;
  const markerTrackR = (outerR + innerR) / 2;
  const totalAngle = 180;
  const gapDeg = 2.2;

  const markerAngle = scoreToAngle(safeScore);
  const marker = polar(cx, cy, markerTrackR, markerAngle);

  return (
    <div
      className={clsx(
        "bg-[radial-gradient(circle_at_50%_14%,rgba(14,22,40,0.06),rgba(0,0,0,0.995)_78%)] px-2 pb-2 pt-1",
        className
      )}
    >
      <div className="mb-3 flex justify-end">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setView("gauge")}
            className={clsx(
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
              view === "gauge"
                ? "bg-white text-slate-950"
                : "text-slate-300 hover:text-white"
            )}
          >
            Gauge
          </button>
          <button
            type="button"
            onClick={() => setView("trend")}
            className={clsx(
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
              view === "trend"
                ? "bg-white text-slate-950"
                : "text-slate-300 hover:text-white"
            )}
          >
            Trend
          </button>
        </div>
      </div>

      {view === "gauge" ? (
        <div className="relative bg-[radial-gradient(circle_at_50%_44%,rgba(8,14,26,0.08),rgba(0,0,0,0)_72%)]">
          <svg viewBox="0 0 320 238" className="h-auto w-full overflow-visible">
            <defs>
              <filter id="gaugeGlowClean" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="markerGlowClean" x="-180%" y="-180%" width="460%" height="460%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <radialGradient id="innerWellClean" cx="50%" cy="54%" r="60%">
                <stop offset="0%" stopColor="rgba(8,12,20,0.18)" />
                <stop offset="54%" stopColor="rgba(3,6,12,0.06)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              <linearGradient id="trackGradientClean" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.008)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>

              <linearGradient id="segmentGlossClean" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
                <stop offset="38%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>

            <ellipse cx={cx} cy={cy + 2} rx="108" ry="74" fill="url(#innerWellClean)" />

            <path
              d={upperArcRingPath(cx, cy, outerR, innerR, 180, 360)}
              fill="url(#trackGradientClean)"
            />

            {VISUAL_SEGMENTS.map((segment) => {
              const startAngle = 180 + (segment.min / 100) * totalAngle + gapDeg / 2;
              const endAngle = 180 + (segment.max / 100) * totalAngle - gapDeg / 2;

              const segmentMid = (segment.min + segment.max) / 2;
              const zone = zoneForScore(segmentMid);
              const isActive = activeZone.key === zone.key;

              return (
                <g key={segment.key}>
                  <path
                    d={upperArcRingPath(cx, cy, outerR, innerR, startAngle, endAngle)}
                    fill={segment.color}
                    opacity={isActive ? 1 : 0.96}
                    filter={isActive ? "url(#gaugeGlowClean)" : undefined}
                  />
                  <path
                    d={upperArcRingPath(cx, cy, outerR, innerR + 9, startAngle, endAngle)}
                    fill="url(#segmentGlossClean)"
                    opacity="0.34"
                  />
                </g>
              );
            })}

            {VISUAL_SEGMENTS.slice(0, -1).map((segment) => {
              const boundaryAngle = 180 + (segment.max / 100) * totalAngle;
              const p1 = polar(cx, cy, innerR - 2, boundaryAngle);
              const p2 = polar(cx, cy, outerR + 2, boundaryAngle);

              return (
                <line
                  key={`${segment.key}-divider`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="rgba(4,7,12,0.95)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              );
            })}

            <circle
              cx={marker.x}
              cy={marker.y}
              r="5.5"
              fill="#ffffff"
              stroke="rgba(255,255,255,0.96)"
              strokeWidth="1.2"
              filter="url(#markerGlowClean)"
            />

            <text
              x={cx}
              y="150"
              textAnchor="middle"
              fill="#f8fafc"
              style={{
                fontSize: "31px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              {safeScore}
            </text>

            {ZONES.map((zone) => {
              const zoneStart = 180 + (zone.min / 100) * totalAngle;
              const zoneEnd = 180 + (zone.max / 100) * totalAngle;

              return (
                <path
                  key={`hover-${zone.key}`}
                  d={upperArcRingPath(
                    cx,
                    cy,
                    outerR + 8,
                    innerR - 8,
                    zoneStart,
                    zoneEnd
                  )}
                  fill="transparent"
                  className="cursor-default"
                  onMouseEnter={() => setHoveredZoneKey(zone.key)}
                  onMouseLeave={() => setHoveredZoneKey(null)}
                />
              );
            })}
          </svg>

          <div className="-mt-3 text-center">
            <span
              className="inline-flex min-w-[160px] justify-center rounded-full border px-5 py-2.5 text-[15px] font-semibold shadow-[0_0_18px_rgba(0,0,0,0.28)]"
              style={{
                color: activeZone.color,
                borderColor: `${activeZone.color}88`,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                boxShadow: `0 0 0 1px ${activeZone.color}10 inset, 0 0 22px ${activeZone.color}10`,
              }}
            >
              {hoveredZoneKey ? activeZone.label : scoreToLabel(safeScore)}
            </span>

            <p className="mx-auto mt-4 max-w-[315px] text-[14px] leading-8 text-slate-200">
              {hoveredZoneKey ? activeZone.tooltip : scoreToTooltip(safeScore)}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <TrendChart points={trendSeries} score={safeScore} />

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {(Object.keys(RANGE_LABELS) as TrendRangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={clsx(
                  "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                  range === key
                    ? "border-white/20 bg-white text-slate-950"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:text-white"
                )}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="mt-4 text-center">
            <span
              className="inline-flex min-w-[160px] justify-center rounded-full border px-5 py-2.5 text-[15px] font-semibold shadow-[0_0_18px_rgba(0,0,0,0.28)]"
              style={{
                color: activeZone.color,
                borderColor: `${activeZone.color}88`,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                boxShadow: `0 0 0 1px ${activeZone.color}10 inset, 0 0 22px ${activeZone.color}10`,
              }}
            >
              {`${scoreToLabel(safeScore)} · ${RANGE_LABELS[range]}`}
            </span>

            <p className="mx-auto mt-4 max-w-[315px] text-[14px] leading-8 text-slate-200">
              {trendSummary}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-white/8 pt-4">
        <h3 className="text-[15px] font-semibold text-slate-100">{summaryTitle}</h3>
        <p className="mt-3 max-w-[34rem] text-[14px] leading-8 text-slate-300">
          {summaryText}
        </p>
      </div>
    </div>
  );
}