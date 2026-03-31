"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MarketInfo } from "@/lib/cot/markets";
import { Info } from "lucide-react";
import TestCurrencyStrengthChart from "./TestCurrencyStrengthChart";
import AnalyzeCotButton, { type CotAnalysisInput } from "./AnalyzeCotButton";

type TestSnapshotRow = {
  market_code: string;
  key: string;
  code: string;
  name: string;
  group: MarketInfo["group"] | "OTHER";
  category: string | null;
  date: string | null;

  longPct: number | null;
  prevLongPct: number | null;
  shortPct: number | null;
  prevShortPct: number | null;

  marketBias: string | null;
  sentiment: string | null;

  netContracts: number | null;
  prevNet: number | null;
  changePct: number | null;
  weeklyChange: number | null;
  netPctOi: number | null;

  usdDirectional: number | null;
  prevUsdDirectional: number | null;

  bias?: string | null;
  reportPrice?: number | null;
  releasePrice?: number | null;
  movePct?: number | null;
  priceDirection?: string | null;
  reaction?: string | null;
};

type FxScoreRow = {
  code: string;
  name: string;
  totalScore: number;
  positioningScore: number;
  reactionScore: number;
  usdFlowScore: number;
  relativeMoveScore: number;
  rank: number;
  sideBias: "long" | "short" | "avoid";
  reactionType: "confirmation" | "fade" | null;
  movePct: number | null;
};

type PairIdea = {
  pair: string;
  direction: "long" | "short";
  longCode: string;
  shortCode: string;
  scoreGap: number;
  rationale: string;
};

const EXCLUDED_FX_CODES = new Set(["MXN"]);

const STANDARD_FX_PAIRS = new Set([
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCAD",
  "USDCHF",
  "EURGBP",
  "EURJPY",
  "EURAUD",
  "EURNZD",
  "EURCAD",
  "EURCHF",
  "GBPJPY",
  "GBPAUD",
  "GBPNZD",
  "GBPCAD",
  "GBPCHF",
  "AUDJPY",
  "AUDNZD",
  "AUDCAD",
  "AUDCHF",
  "NZDJPY",
  "NZDCAD",
  "NZDCHF",
  "CADJPY",
  "CADCHF",
  "CHFJPY",
]);

const CATS: Array<"ALL" | MarketInfo["group"] | "OTHER"> = [
  "ALL",
  "FX",
  "ENERGY",
  "INDEX",
  "METALS",
  "AGRI",
  "RATES",
  "CRYPTO",
  "OTHER",
];

function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString();
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v.toFixed(2)}%`;
}

function fmtPctSigned(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtPx(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(5);
}

function fmtIndex(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(2);
}

function fmtUsdDirectional(v: number | null | undefined) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "up" | "down" | "warn";
  children: React.ReactNode;
}) {
  const map = {
    neutral: "bg-white/6 text-slate-300 ring-white/10",
    up: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    down: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    warn: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  } as const;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        map[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function biasTone(v: string | null | undefined): "neutral" | "up" | "down" {
  if (!v) return "neutral";
  return /bullish/i.test(v) ? "up" : /bearish/i.test(v) ? "down" : "neutral";
}

function sentimentTone(
  v: string | null | undefined
): "neutral" | "up" | "down" | "warn" {
  if (!v) return "neutral";
  if (/increasing bullish/i.test(v)) return "up";
  if (/increasing bearish/i.test(v)) return "down";
  if (/less bullish/i.test(v) || /less bearish/i.test(v)) return "warn";
  return /bullish/i.test(v) ? "up" : /bearish/i.test(v) ? "down" : "neutral";
}

function reactionTone(v: string | null | undefined): "neutral" | "up" | "warn" {
  if (v === "confirmation") return "up";
  if (v === "fade") return "warn";
  return "neutral";
}

function TooltipInfo({
  text,
  align = "center",
}: {
  text: string;
  align?: "center" | "right";
}) {
  const positionClass =
    align === "right"
      ? "right-0 left-auto translate-x-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-200"
        aria-label="More information"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        className={[
          "pointer-events-none absolute top-full z-20 mt-2 hidden w-80 rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs leading-5 text-slate-300 shadow-2xl group-hover:block",
          positionClass,
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}

function reactionHelpText() {
  return "For the snapshot page, the reaction pill is shift-aware. That means it compares price direction into release against the positioning read itself: Increasing Bullish expects price up, Less Bullish expects price down, Increasing Bearish expects price down, and Less Bearish expects price up.";
}

function pricePathHelpText() {
  return "For FX markets, the path is shown as a simple indexed display where report = 100.00 and release is scaled from that. For non-FX markets, the stored market price is shown directly.";
}

function sectorLabel(group: TestSnapshotRow["group"]) {
  if (group === "FX") return "Currencies";
  if (group === "ENERGY") return "Energies";
  if (group === "METALS") return "Metals";
  if (group === "AGRI") return "Agri";
  return group;
}

function isFxRow(row: TestSnapshotRow) {
  return row.group === "FX";
}

function isScoredFxRow(row: TestSnapshotRow) {
  return row.group === "FX" && !EXCLUDED_FX_CODES.has(row.code);
}

function getIndexedPath(row: TestSnapshotRow) {
  if (!isFxRow(row)) {
    return {
      report: row.reportPrice,
      release: row.releasePrice,
      isIndexed: false,
    };
  }

  if (row.reportPrice == null || row.releasePrice == null || row.reportPrice === 0) {
    return {
      report: null,
      release: null,
      isIndexed: true,
    };
  }

  return {
    report: 100,
    release: (row.releasePrice / row.reportPrice) * 100,
    isIndexed: true,
  };
}

function expectedDirectionFromSentiment(
  sentiment: string | null | undefined,
  bias: string | null | undefined
): "up" | "down" | null {
  const s = (sentiment ?? "").toLowerCase();
  const b = (bias ?? "").toLowerCase();

  if (s.includes("increasing bullish")) return "up";
  if (s.includes("less bullish")) return "down";
  if (s.includes("increasing bearish")) return "down";
  if (s.includes("less bearish")) return "up";

  if (s.includes("flat bullish")) return "up";
  if (s.includes("flat bearish")) return "down";

  if (b === "bullish") return "up";
  if (b === "bearish") return "down";

  return null;
}

function deriveShiftAwareReaction(row: TestSnapshotRow): "confirmation" | "fade" | null {
  const expected = expectedDirectionFromSentiment(row.sentiment, row.marketBias ?? row.bias);
  const actual = row.priceDirection;

  if (!expected || !actual || actual === "flat") return null;
  return expected === actual ? "confirmation" : "fade";
}

function reactionLabel(row: TestSnapshotRow) {
  const derived = deriveShiftAwareReaction(row);
  if (!derived) return "—";
  return derived === "confirmation" ? "Confirmation" : "Fade";
}

function buildFxScores(allRows: TestSnapshotRow[]): FxScoreRow[] {
  const fxRows = allRows.filter(isScoredFxRow);
  if (!fxRows.length) return [];

  const maxAbsMove = Math.max(
    0.25,
    ...fxRows.map((r) => Math.abs(r.movePct ?? 0))
  );

  const maxAbsUsdFlow = Math.max(
    500_000_000,
    ...fxRows.map((r) =>
      Math.abs(
        r.usdDirectional != null && r.prevUsdDirectional != null
          ? r.usdDirectional - r.prevUsdDirectional
          : 0
      )
    )
  );

  const scored = fxRows.map((row) => {
    const reactionType = deriveShiftAwareReaction(row);
    const movePct = row.movePct ?? 0;
    const netPctOi = row.netPctOi ?? 0;
    const usdFlowChange =
      row.usdDirectional != null && row.prevUsdDirectional != null
        ? row.usdDirectional - row.prevUsdDirectional
        : 0;

    const positioningScore = clamp(netPctOi / 5, -3, 3);

    let reactionScore = 0;
    if (reactionType === "confirmation") {
      reactionScore = movePct >= 0 ? 2.5 : -2.5;
    } else if (reactionType === "fade") {
      reactionScore = movePct >= 0 ? 1.25 : -1.25;
    }

    const usdFlowScore = clamp((usdFlowChange / maxAbsUsdFlow) * 3, -3, 3);
    const relativeMoveScore = clamp((movePct / maxAbsMove) * 3, -3, 3);

    const totalScore =
      positioningScore * 0.3 +
      reactionScore * 0.3 +
      usdFlowScore * 0.2 +
      relativeMoveScore * 0.2;

    let sideBias: "long" | "short" | "avoid" = "avoid";
    if (totalScore >= 1) sideBias = "long";
    else if (totalScore <= -1) sideBias = "short";

    return {
      code: row.code,
      name: row.name,
      totalScore,
      positioningScore,
      reactionScore,
      usdFlowScore,
      relativeMoveScore,
      rank: 0,
      sideBias,
      reactionType,
      movePct: row.movePct ?? null,
    };
  });

  return scored;
}

function buildSyntheticUsdScore(nonUsdScores: FxScoreRow[]): FxScoreRow | null {
  if (!nonUsdScores.length) return null;

  const avgPositioning =
    nonUsdScores.reduce((sum, s) => sum + s.positioningScore, 0) / nonUsdScores.length;
  const avgReaction =
    nonUsdScores.reduce((sum, s) => sum + s.reactionScore, 0) / nonUsdScores.length;
  const avgUsdFlow =
    nonUsdScores.reduce((sum, s) => sum + s.usdFlowScore, 0) / nonUsdScores.length;
  const avgMove =
    nonUsdScores.reduce((sum, s) => sum + s.relativeMoveScore, 0) / nonUsdScores.length;

  const positioningScore = -avgPositioning;
  const reactionScore = -avgReaction;
  const usdFlowScore = -avgUsdFlow;
  const relativeMoveScore = -avgMove;

  const totalScore =
    positioningScore * 0.3 +
    reactionScore * 0.3 +
    usdFlowScore * 0.2 +
    relativeMoveScore * 0.2;

  let sideBias: "long" | "short" | "avoid" = "avoid";
  if (totalScore >= 1) sideBias = "long";
  else if (totalScore <= -1) sideBias = "short";

  let reactionType: "confirmation" | "fade" | null = null;
  if (reactionScore >= 0.75) reactionType = "confirmation";
  else if (reactionScore <= -0.75) reactionType = "fade";

  return {
    code: "USD",
    name: "US Dollar",
    totalScore,
    positioningScore,
    reactionScore,
    usdFlowScore,
    relativeMoveScore,
    rank: 0,
    sideBias,
    reactionType,
    movePct: null,
  };
}

function rankCurrencyScores(baseScores: FxScoreRow[]): FxScoreRow[] {
  const ranked = [...baseScores].sort((a, b) => b.totalScore - a.totalScore);
  return ranked.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

function resolveTradablePair(
  longCode: string,
  shortCode: string
): { pair: string; direction: "long" | "short" } | null {
  const direct = `${longCode}${shortCode}`;
  if (STANDARD_FX_PAIRS.has(direct)) {
    return { pair: direct, direction: "long" };
  }

  const inverse = `${shortCode}${longCode}`;
  if (STANDARD_FX_PAIRS.has(inverse)) {
    return { pair: inverse, direction: "short" };
  }

  return null;
}

function buildTopPairIdeas(scores: FxScoreRow[]): PairIdea[] {
  if (scores.length < 2) return [];

  const strongest = scores.slice(0, Math.min(5, scores.length));
  const weakest = [...scores].reverse().slice(0, Math.min(5, scores.length));

  const ideas: PairIdea[] = [];

  for (const strong of strongest) {
    for (const weak of weakest) {
      if (strong.code === weak.code) continue;

      const scoreGap = strong.totalScore - weak.totalScore;
      if (scoreGap <= 0) continue;

      const resolved = resolveTradablePair(strong.code, weak.code);
      if (!resolved) continue;

      const rationale = `${strong.code} ranks stronger than ${weak.code} on positioning, indexed reaction, and inferred USD-flow-relative logic.`;

      ideas.push({
        pair: resolved.pair,
        direction: resolved.direction,
        longCode: strong.code,
        shortCode: weak.code,
        scoreGap,
        rationale,
      });
    }
  }

  const unique = new Map<string, PairIdea>();
  for (const idea of ideas.sort((a, b) => b.scoreGap - a.scoreGap)) {
    const key = `${idea.pair}:${idea.direction}`;
    if (!unique.has(key)) unique.set(key, idea);
  }

  return Array.from(unique.values()).slice(0, 5);
}

function buildSnapshotAnalysisInput(
  row: TestSnapshotRow,
  allRows: TestSnapshotRow[],
  range: string,
  allCurrencyScores: FxScoreRow[],
  topPairIdeas: PairIdea[],
  syntheticUsd: FxScoreRow | null
): CotAnalysisInput {
  const isFx = isScoredFxRow(row);
  const fxPeers = allRows.filter((r) => isScoredFxRow(r) && r.code !== row.code);

  const confirmationCount = fxPeers.filter(
    (r) => deriveShiftAwareReaction(r) === "confirmation"
  ).length;

  const fadeCount = fxPeers.filter(
    (r) => deriveShiftAwareReaction(r) === "fade"
  ).length;

  const current = allCurrencyScores.find((x) => x.code === row.code) ?? null;

  const strongerPeers = current
    ? allCurrencyScores
        .filter((s) => s.code !== row.code && s.code !== "USD" && s.totalScore > current.totalScore)
        .slice(0, 3)
        .map((s) => s.code)
    : [];

  const weakerPeers = current
    ? [...allCurrencyScores]
        .filter((s) => s.code !== row.code && s.code !== "USD" && s.totalScore < current.totalScore)
        .slice(-3)
        .map((s) => s.code)
    : [];

  const path = getIndexedPath(row);
  const weeklyUsdDirectionalChange =
    row.usdDirectional != null && row.prevUsdDirectional != null
      ? row.usdDirectional - row.prevUsdDirectional
      : null;

  const reactionType = deriveShiftAwareReaction(row);

  const relevantPairIdeas = isFx
    ? topPairIdeas.filter(
        (p) => p.longCode === row.code || p.shortCode === row.code
      )
    : [];

  return {
    asset: row.name,
    code: row.code,
    group: row.group,
    range,
    latestDate: row.date,

    latestNet: row.netContracts,
    prevNet: row.prevNet,
    weeklyChange: row.weeklyChange,

    longPct: row.longPct,
    shortPct: row.shortPct,
    netPctOi: row.netPctOi,

    latestLargeUsd: row.usdDirectional,
    weeklyLargeUsdChange: weeklyUsdDirectionalChange,

    indexedReportPrice: path.isIndexed ? path.report : null,
    indexedReleasePrice: path.isIndexed ? path.release : null,
    reportPrice: row.reportPrice,
    releasePrice: row.releasePrice,
    movePct: row.movePct,
    priceDirection: row.priceDirection,
    reactionType,
    isFx,

    crossMarket: isFx
      ? {
          peerCount: fxPeers.length,
          confirmationCount,
          fadeCount,
          strongerPeers,
          weakerPeers,
          summary:
            fxPeers.length > 0
              ? `${confirmationCount} FX confirmations and ${fadeCount} fades across peers this week, excluding MXN.`
              : null,
        }
      : null,

    peerRanking: isFx && current
      ? {
          rank: current.rank,
          totalPeers: allCurrencyScores.length,
          score: current.totalScore,
          positioningScore: current.positioningScore,
          reactionScore: current.reactionScore,
          usdFlowScore: current.usdFlowScore,
          relativeMoveScore: current.relativeMoveScore,
          strongestPeers: allCurrencyScores.slice(0, 3).map((s) => s.code),
          weakestPeers: [...allCurrencyScores].slice(-3).map((s) => s.code),
          sideBias: current.sideBias,
          summary: `${row.code} ranks ${current.rank}/${allCurrencyScores.length} across the tradable FX complex including synthetic USD, excluding MXN.`,
        }
      : null,

    syntheticUsd: syntheticUsd
      ? {
          included: true,
          score: syntheticUsd.totalScore,
          sideBias: syntheticUsd.sideBias,
          reactionType: syntheticUsd.reactionType,
          summary: `Synthetic USD is inferred from the inverse FX basket and currently has a ${syntheticUsd.sideBias} bias.`,
        }
      : null,

    pairIdeas: isFx
      ? {
          topSetups: relevantPairIdeas.map((idea) => ({
            pair: idea.pair,
            direction: idea.direction,
            longCode: idea.longCode,
            shortCode: idea.shortCode,
            scoreGap: idea.scoreGap,
            rationale: idea.rationale,
          })),
          summary:
            relevantPairIdeas.length > 0
              ? `${relevantPairIdeas.length} top-ranked tradable pair idea(s) involve ${row.code}.`
              : `${row.code} is not currently in the top-ranked tradable pair list.`,
        }
      : null,

    notes:
      "Snapshot-based analysis using currently available fields only: net change, long/short %, net % OI, USD directional exposure, indexed report-to-release reaction, peer ranking, synthetic USD inference, and tradable pair ideas. MXN excluded from FX comparison.",
  };
}

export default function TestCotPageClient() {
  const [rows, setRows] = useState<TestSnapshotRow[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");
  const [range, setRange] = useState("1y");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cot/test-snapshot?v=" + Date.now(), {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setDate(json.date ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();

    return rows.filter((r) => {
      const catOk = cat === "ALL" || r.group === cat;
      const qOk =
        !search ||
        r.code.toLowerCase().includes(search) ||
        r.name.toLowerCase().includes(search) ||
        r.group.toLowerCase().includes(search) ||
        (r.marketBias ?? "").toLowerCase().includes(search) ||
        (r.sentiment ?? "").toLowerCase().includes(search) ||
        (r.reaction ?? "").toLowerCase().includes(search);

      return catOk && qOk;
    });
  }, [rows, q, cat]);

  const summary = useMemo(() => {
    const fxRows = rows.filter((r) => r.group === "FX");
    const scoredFxRows = rows.filter(isScoredFxRow);

    const usdDirectional = scoredFxRows.reduce(
      (sum, row) => sum + (row.usdDirectional ?? 0),
      0
    );

    const confirmations = scoredFxRows.filter(
      (r) => deriveShiftAwareReaction(r) === "confirmation"
    ).length;
    const fades = scoredFxRows.filter((r) => deriveShiftAwareReaction(r) === "fade").length;

    return {
      totalMarkets: rows.length,
      fxMarkets: fxRows.length,
      scoredFxMarkets: scoredFxRows.length,
      usdDirectional,
      confirmations,
      fades,
    };
  }, [rows]);

  const nonUsdScores = useMemo(() => buildFxScores(rows), [rows]);

  const syntheticUsd = useMemo(
    () => buildSyntheticUsdScore(nonUsdScores),
    [nonUsdScores]
  );

  const allCurrencyScores = useMemo(() => {
    const base = syntheticUsd ? [...nonUsdScores, syntheticUsd] : [...nonUsdScores];
    return rankCurrencyScores(base);
  }, [nonUsdScores, syntheticUsd]);

  const topPairIdeas = useMemo(
    () => buildTopPairIdeas(allCurrencyScores),
    [allCurrencyScores]
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Latest week
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {date ?? "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Markets loaded
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {summary.totalMarkets}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            FX directional USD basket
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {fmtUsdDirectional(summary.usdDirectional)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Excluding MXN
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            FX confirmations
          </div>
          <div className="mt-2 text-lg font-semibold text-emerald-300">
            {summary.confirmations}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Excluding MXN
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            FX fades
          </div>
          <div className="mt-2 text-lg font-semibold text-amber-300">
            {summary.fades}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Excluding MXN
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {["1y", "ytd", "3y", "5y"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                "rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors",
                range === r
                  ? "bg-violet-600 text-white ring-violet-500"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10",
              ].join(" ")}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <TestCurrencyStrengthChart range={range} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbol, market, sector, sentiment, or reaction..."
          className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-white/20"
        />

        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={[
                "rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors",
                cat === c
                  ? "bg-violet-600 text-white ring-violet-500"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10",
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-400">
        Latest DB-backed COT snapshot {date ? `• Week of ${date}` : ""}
        {loading ? " • loading..." : ""}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400">
                <th className="px-4 py-3 text-left font-medium">Symbol</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Sector</th>
                <th className="px-4 py-3 text-left font-medium">Market</th>
                <th className="px-4 py-3 text-left font-medium">Sentiment</th>
                <th className="px-4 py-3 text-left font-medium">Long%</th>
                <th className="px-4 py-3 text-left font-medium">Prev Long%</th>
                <th className="px-4 py-3 text-left font-medium">Short%</th>
                <th className="px-4 py-3 text-left font-medium">Prev Short%</th>
                <th className="px-4 py-3 text-left font-medium">Net Pos</th>
                <th className="px-4 py-3 text-left font-medium">Prev Net</th>
                <th className="px-4 py-3 text-left font-medium">Change</th>
                <th className="px-4 py-3 text-left font-medium">USD Notional</th>
                <th className="px-4 py-3 text-left font-medium">Prev USD Notional</th>
                <th className="px-4 py-3 text-left font-medium min-w-[260px]">
                  <div className="flex items-center gap-2">
                    <span>Price Move</span>
                    <TooltipInfo text={reactionHelpText()} align="right" />
                  </div>
                </th>
                <th className="w-[36px] px-1 py-3 text-center font-medium text-slate-600">
                  AI
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const path = getIndexedPath(r);
                const shiftReaction = deriveShiftAwareReaction(r);
                const hasReaction =
                  r.reportPrice != null || r.releasePrice != null || r.movePct != null;

                const analysisInput: CotAnalysisInput = buildSnapshotAnalysisInput(
                  r,
                  rows,
                  range,
                  allCurrencyScores,
                  topPairIdeas,
                  syntheticUsd
                );

                return (
                  <tr
                    key={`${r.market_code}-${r.date}`}
                    className="border-t border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5 text-slate-200">{r.code}</td>

                    <td className="px-4 py-2.5 text-slate-200">
                      <Link
                        href={`/test-cot/${encodeURIComponent(r.key)}?range=${encodeURIComponent(range)}`}
                        className="hover:text-violet-300 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>

                    <td className="px-4 py-2.5 text-slate-300">
                      {sectorLabel(r.group)}
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge tone={biasTone(r.marketBias)}>{r.marketBias ?? "—"}</Badge>
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge tone={sentimentTone(r.sentiment)}>{r.sentiment ?? "—"}</Badge>
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtPct(r.longPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtPct(r.prevLongPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtPct(r.shortPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtPct(r.prevShortPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtNum(r.netContracts)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtNum(r.prevNet)}
                    </td>

                    <td className="px-4 py-2.5">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                          (r.changePct ?? 0) > 0
                            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                            : (r.changePct ?? 0) < 0
                            ? "bg-rose-500/10 text-rose-300 ring-rose-500/20"
                            : "bg-white/6 text-slate-300 ring-white/10",
                        ].join(" ")}
                      >
                        {fmtPctSigned(r.changePct)}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtUsdDirectional(r.usdDirectional)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtUsdDirectional(r.prevUsdDirectional)}
                    </td>

                    <td className="px-4 py-2.5">
                      {hasReaction ? (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums text-slate-100">
                              {fmtPctSigned(r.movePct)}
                            </span>
                            <Badge tone={reactionTone(shiftReaction)}>
                              {reactionLabel(r)}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            Report → Release
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {path.isIndexed
                              ? `${fmtIndex(path.report)} → ${fmtIndex(path.release)}`
                              : `${fmtPx(path.report)} → ${fmtPx(path.release)}`}
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="tabular-nums text-slate-100">—</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            Report: {isFxRow(r) ? fmtIndex(100) : fmtPx(r.reportPrice)}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="w-[36px] px-1 py-2.5 text-center">
                      <AnalyzeCotButton input={analysisInput} compact />
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-4 py-6 text-slate-400">
                    No results
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Price path note:</span>
        <TooltipInfo text={pricePathHelpText()} />
      </div>
    </div>
  );
}