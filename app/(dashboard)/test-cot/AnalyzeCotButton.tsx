"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, RefreshCw, Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import clsx from "clsx";

type AnalyzeRequest = {
  click: true;
  force: boolean;
  noStyle: true;
  asset: string;
  code: string;
  latestDate?: string | null;
  inputSnapshot: CotAnalysisInput;
  testPrompt?: string;
};

type AnalyzeResponse = {
  ok: boolean;
  text?: string;
  cached?: boolean;
  error?: string;
};

export type CotAnalysisInput = {
  asset: string;
  code: string;
  group?: string | null;
  range?: string | null;
  latestDate?: string | null;

  latestNet?: number | null;
  prevNet?: number | null;
  weeklyChange?: number | null;

  longPct?: number | null;
  shortPct?: number | null;
  netPctOi?: number | null;
  openInterest?: number | null;

  largeLong?: number | null;
  largeShort?: number | null;
  grossContracts?: number | null;
  netPctGross?: number | null;

  weeklyLongChange?: number | null;
  weeklyShortChange?: number | null;
  weeklyOiChange?: number | null;

  latestLargeUsd?: number | null;
  latestSmallUsd?: number | null;
  latestCommUsd?: number | null;
  weeklyLargeUsdChange?: number | null;

  indexedReportPrice?: number | null;
  indexedReleasePrice?: number | null;
  reportPrice?: number | null;
  releasePrice?: number | null;
  movePct?: number | null;
  priceDirection?: string | null;
  reactionType?: string | null;
  isFx?: boolean | null;

  netRangePct?: number | null;
  usdRangePct?: number | null;
  oiVsAvgPct?: number | null;

  crossMarket?: {
    peerCount?: number | null;
    confirmationCount?: number | null;
    fadeCount?: number | null;
    strongerPeers?: string[];
    weakerPeers?: string[];
    summary?: string | null;
  } | null;

  peerRanking?: {
    rank?: number | null;
    totalPeers?: number | null;
    score?: number | null;
    positioningScore?: number | null;
    reactionScore?: number | null;
    usdFlowScore?: number | null;
    relativeMoveScore?: number | null;
    strongestPeers?: string[];
    weakestPeers?: string[];
    sideBias?: "long" | "short" | "avoid" | null;
    summary?: string | null;
  } | null;

  syntheticUsd?: {
    included?: boolean | null;
    score?: number | null;
    sideBias?: "long" | "short" | "avoid" | null;
    reactionType?: "confirmation" | "fade" | null;
    summary?: string | null;
  } | null;

  pairIdeas?: {
    topSetups?: Array<{
      pair: string;
      direction: "long" | "short";
      longCode: string;
      shortCode: string;
      scoreGap: number | null;
      rationale: string;
    }>;
    summary?: string | null;
  } | null;

  notes?: string | null;
};

function fmtNum(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return v.toLocaleString();
}

function fmtPct(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return `${v.toFixed(2)}%`;
}

function fmtScore(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return v.toFixed(2);
}

function fmtUsd(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function buildLeanPrompt(input: CotAnalysisInput) {
  const compact = {
    asset: input.asset,
    code: input.code,
    group: input.group ?? null,
    range: input.range ?? null,
    isFx: input.isFx ?? null,
    latestDate: input.latestDate ?? null,

    latestNet: input.latestNet ?? null,
    prevNet: input.prevNet ?? null,
    weeklyChange: input.weeklyChange ?? null,

    longPct: input.longPct ?? null,
    shortPct: input.shortPct ?? null,
    netPctOi: input.netPctOi ?? null,
    openInterest: input.openInterest ?? null,

    largeLong: input.largeLong ?? null,
    largeShort: input.largeShort ?? null,
    grossContracts: input.grossContracts ?? null,
    netPctGross: input.netPctGross ?? null,

    weeklyLongChange: input.weeklyLongChange ?? null,
    weeklyShortChange: input.weeklyShortChange ?? null,
    weeklyOiChange: input.weeklyOiChange ?? null,

    latestLargeUsd: input.latestLargeUsd ?? null,
    latestSmallUsd: input.latestSmallUsd ?? null,
    latestCommUsd: input.latestCommUsd ?? null,
    weeklyLargeUsdChange: input.weeklyLargeUsdChange ?? null,

    indexedReportPrice: input.indexedReportPrice ?? null,
    indexedReleasePrice: input.indexedReleasePrice ?? null,
    reportPrice: input.reportPrice ?? null,
    releasePrice: input.releasePrice ?? null,
    movePct: input.movePct ?? null,
    priceDirection: input.priceDirection ?? null,
    reactionType: input.reactionType ?? null,

    netRangePct: input.netRangePct ?? null,
    usdRangePct: input.usdRangePct ?? null,
    oiVsAvgPct: input.oiVsAvgPct ?? null,

    crossMarket: input.crossMarket ?? null,
    peerRanking: input.peerRanking ?? null,
    syntheticUsd: input.syntheticUsd ?? null,
    pairIdeas: input.pairIdeas ?? null,
    notes: input.notes ?? null,
  };

  const jsonBlock = JSON.stringify(compact, null, 2);

  return [
    "You are a senior macro strategist and futures positioning analyst.",
    "Use only the provided JSON facts.",
    "Do not invent missing data.",
    "Be concise, analytical, and trader-relevant.",
    "",
    "JSON INPUT:",
    "```json",
    jsonBlock,
    "```",
    "",
    "Interpretation priorities:",
    "1. Explain speculative positioning direction, depth, and weekly change.",
    "2. Explain the weekly change using only the fields provided. If long/short decomposition is missing, say the snapshot only shows net movement rather than full flow decomposition.",
    "3. Judge crowding/stretch using netPctOi, netPctGross, netRangePct, usdRangePct, and oiVsAvgPct only where available.",
    "4. Compare positioning with price reaction into release.",
    "5. For FX, prioritise indexed currency interpretation over raw pair interpretation.",
    "6. Emphasise whether price action confirmed or faded the positioning read, and whether USD directional flow improved or deteriorated.",
    "7. Use peerRanking and crossMarket to compare this currency against peers.",
    "8. If syntheticUsd is included, use it as inferred broad USD strength/weakness from the inverse FX basket.",
    "9. State clearly whether the currency is better used from the long side, short side, or avoided as middle-of-pack.",
    "10. If pairIdeas are present, mention the most relevant tradable setups using standard pair notation and whether the symbol is a long or short.",
    "",
    "Write the output in these exact sections:",
    "### Positioning summary",
    "### What changed this week",
    "### Crowd / stretch assessment",
    "### Price reaction into release",
    "### Relative strength / cross-market read",
    "### Pair construction ideas",
    "### Trading takeaway",
    "",
    "Rules:",
    "- Write 9 to 12 bullets total.",
    "- No filler.",
    "- Complete all sections.",
    "- Keep each bullet concrete and fairly short.",
  ].join("\n");
}

function RenderBrief({ text }: { text: string }) {
  const blocks = React.useMemo(() => {
    const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");

    type Block =
      | { kind: "h3"; text: string }
      | { kind: "ul"; items: string[] }
      | { kind: "p"; text: string };

    const out: Block[] = [];
    let pBuf: string[] = [];
    let ulBuf: string[] = [];

    const flushP = () => {
      const t = pBuf.join(" ").trim();
      if (t) out.push({ kind: "p", text: t });
      pBuf = [];
    };

    const flushUL = () => {
      if (ulBuf.length) out.push({ kind: "ul", items: ulBuf });
      ulBuf = [];
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        flushUL();
        flushP();
        continue;
      }

      const h3 = line.match(/^###\s+(.*)$/);
      if (h3) {
        flushUL();
        flushP();
        out.push({ kind: "h3", text: h3[1].trim() });
        continue;
      }

      const bullet = line.match(/^[-•]\s+(.*)$/);
      if (bullet) {
        flushP();
        ulBuf.push(bullet[1].trim());
        continue;
      }

      flushUL();
      pBuf.push(line);
    }

    flushUL();
    flushP();
    return out;
  }, [text]);

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.kind === "h3") {
          return (
            <div key={i} className="pt-1">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Section
              </div>
              <div className="text-base font-semibold text-neutral-100">
                {b.text}
              </div>
            </div>
          );
        }

        if (b.kind === "ul") {
          return (
            <ul
              key={i}
              className="list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-200"
            >
              {b.items.map((it, j) => (
                <li key={j} className="marker:text-neutral-600">
                  {it}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-sm leading-6 text-neutral-200">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800/70 bg-neutral-900/35 px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-100">
        {value}
      </div>
    </div>
  );
}

function SkeletonLine({ short }: { short?: boolean }) {
  return (
    <div
      className={clsx(
        "h-3 rounded-full bg-neutral-800/70 animate-pulse",
        short ? "w-2/3" : "w-full"
      )}
    />
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-200ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce [animation-delay:-100ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-bounce" />
    </span>
  );
}

export default function AnalyzeCotButton({
  input,
  force = false,
  compact = false,
}: {
  input: CotAnalysisInput;
  force?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string>("");
  const [cached, setCached] = React.useState<boolean | null>(null);

  async function run(forceRefresh = force): Promise<void> {
    try {
      setBusy(true);
      setError(null);

      const testPrompt = buildLeanPrompt(input);

      const body: AnalyzeRequest = {
        click: true,
        force: forceRefresh,
        noStyle: true,
        asset: input.asset,
        code: input.code,
        latestDate: input.latestDate ?? null,
        inputSnapshot: input,
        testPrompt,
      };

      const res = await fetch("/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => ({}))) as Partial<AnalyzeResponse>;
      if (!json?.ok) throw new Error(json?.error || "AI request failed");

      setCached(Boolean(json.cached));
      setText(String(json.text ?? "").trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v && !text && !busy) void run();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label={`Analyze ${input.code}`}
            className="inline-flex h-5 w-5 items-center justify-center text-slate-600 transition-colors hover:text-slate-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="border-neutral-700 bg-neutral-900 text-slate-300 hover:bg-neutral-800 hover:text-white"
            aria-label="Analyze positioning"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={clsx(
          "fixed right-0 top-0 h-screen w-full max-w-2xl translate-x-0 rounded-none border-l border-neutral-800 border-t-0 border-r-0 border-b-0",
          "bg-neutral-950/95 p-0 text-neutral-100 shadow-2xl backdrop-blur",
          "flex flex-col overflow-hidden"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-800/70 bg-neutral-950/70 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="flex min-w-0 items-center gap-3 text-base sm:text-lg">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20">
                <Sparkles className="h-4 w-4 text-fuchsia-300" />
              </span>

              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {input.asset} ({input.code})
                </span>
                <span className="mt-0.5 block truncate text-xs text-neutral-400">
                  Snapshot positioning brief
                  {input.latestDate ? ` • Week of ${input.latestDate}` : ""}
                </span>
              </span>

              {cached !== null && (
                <Badge
                  variant="outline"
                  className={clsx(
                    "ml-2 border-neutral-700",
                    cached
                      ? "text-neutral-300"
                      : "border-emerald-700/40 text-emerald-300"
                  )}
                >
                  {cached ? "From cache" : "Fresh"}
                </Badge>
              )}
            </DialogTitle>

            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-neutral-300 hover:text-neutral-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            <MetricCard label="Latest Net" value={fmtNum(input.latestNet)} />
            <MetricCard label="Weekly Change" value={fmtNum(input.weeklyChange)} />
            <MetricCard label="Long %" value={fmtPct(input.longPct)} />
            <MetricCard label="Short %" value={fmtPct(input.shortPct)} />
            <MetricCard label="Net % OI" value={fmtPct(input.netPctOi)} />
            <MetricCard label="Move %" value={fmtPct(input.movePct)} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="USD Directional" value={fmtUsd(input.latestLargeUsd)} />
            <MetricCard
              label="Weekly USD Change"
              value={fmtUsd(input.weeklyLargeUsdChange)}
            />
            <MetricCard
              label="Reaction"
              value={input.reactionType ? input.reactionType : "N/A"}
            />
            <MetricCard
              label="Peer Score"
              value={fmtScore(input.peerRanking?.score ?? null)}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard
              label="Peer Rank"
              value={
                input.peerRanking?.rank != null && input.peerRanking?.totalPeers != null
                  ? `${input.peerRanking.rank}/${input.peerRanking.totalPeers}`
                  : "N/A"
              }
            />
            <MetricCard
              label="Preferred Side"
              value={input.peerRanking?.sideBias ?? "N/A"}
            />
            <MetricCard
              label="Synthetic USD"
              value={input.syntheticUsd?.sideBias ?? "N/A"}
            />
            <MetricCard
              label="Top Setup"
              value={
                input.pairIdeas?.topSetups?.[0]
                  ? `${input.pairIdeas.topSetups[0].direction} ${input.pairIdeas.topSetups[0].pair}`
                  : "N/A"
              }
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pr-3 [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-prose rounded-2xl border border-neutral-800/70 bg-neutral-900/35 p-4 sm:p-5">
            {busy && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking</span>
                  <ThinkingDots />
                </div>
                <SkeletonLine />
                <SkeletonLine />
                <SkeletonLine />
                <SkeletonLine short />
              </div>
            )}

            {!busy && error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error}
              </div>
            )}

            {!busy && !error && (
              <>
                {text ? (
                  <RenderBrief text={text} />
                ) : (
                  <div className="text-sm text-neutral-400">—</div>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-neutral-800/70 bg-neutral-950/70 px-5 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-[11px] text-neutral-500">
              Snapshot positioning + indexed reaction + inferred USD + tradable pair ideas.
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(true)}
                className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                size="sm"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                {busy ? "Thinking…" : "Refresh"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                disabled={!text}
                onClick={() => {
                  if (text) void navigator.clipboard?.writeText(text).catch(() => {});
                }}
                className={clsx(
                  "text-neutral-300 hover:text-neutral-100",
                  !text && "opacity-50"
                )}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}