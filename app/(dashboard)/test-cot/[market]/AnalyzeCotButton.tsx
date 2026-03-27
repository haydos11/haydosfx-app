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

function buildLeanPrompt(input: CotAnalysisInput) {
  const compact = {
    asset: input.asset,
    code: input.code,
    isFx: input.isFx ?? null,
    latestDate: input.latestDate ?? null,

    latestNet: input.latestNet ?? null,
    prevNet: input.prevNet ?? null,
    weeklyChange: input.weeklyChange ?? null,

    largeLong: input.largeLong ?? null,
    largeShort: input.largeShort ?? null,
    grossContracts: input.grossContracts ?? null,
    longPct: input.longPct ?? null,
    shortPct: input.shortPct ?? null,
    netPctOi: input.netPctOi ?? null,
    netPctGross: input.netPctGross ?? null,
    openInterest: input.openInterest ?? null,
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
    "2. Explain whether the weekly change came from long build, short build, covering, or reduced participation.",
    "3. Judge crowding/stretch using netPctOi, netPctGross, netRangePct, usdRangePct, and oiVsAvgPct where available.",
    "4. Compare positioning with price reaction into release.",
    "5. For FX, prioritise indexed currency interpretation over raw pair interpretation.",
    "6. Use crossMarket context only if it adds value: stronger peers, weaker peers, confirmation/fade balance.",
    "7. If the currency held up better than positioning implied, say so clearly.",
    "8. If the asset looks middle-of-pack rather than outright strong/weak, say that.",
    "",
    "Write the output in these exact sections:",
    "### Positioning summary",
    "### What changed this week",
    "### Crowd / stretch assessment",
    "### Price reaction into release",
    "### Relative strength / cross-market read",
    "### Trading takeaway",
    "",
    "Rules:",
    "- Write 8 to 10 bullets total.",
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
}: {
  input: CotAnalysisInput;
  force?: boolean;
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
        <Button
          variant="outline"
          className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Analyze positioning
        </Button>
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
                  COT analyst positioning brief
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
            <MetricCard label="Gross" value={fmtNum(input.grossContracts)} />
            <MetricCard label="Net % OI" value={fmtPct(input.netPctOi)} />
            <MetricCard label="Net % Gross" value={fmtPct(input.netPctGross)} />
            <MetricCard label="Move %" value={fmtPct(input.movePct)} />
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
              Positioning + price reaction + lean peer context.
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