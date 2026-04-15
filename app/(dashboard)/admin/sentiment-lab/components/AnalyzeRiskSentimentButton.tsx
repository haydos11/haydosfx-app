"use client";

import * as React from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sparkles,
  X,
  RefreshCw,
  Copy,
  Loader2,
  TrendingUp,
  ShieldAlert,
  Activity,
  BarChart3,
} from "lucide-react";

type AnalyzeRequest = {
  click: true;
  force: boolean;
  noStyle: true;
  asset: string;
  code: string;
  latestDate?: string | null;
  inputSnapshot: RiskSentimentAnalysisInput;
  testPrompt?: string;
};

type AnalyzeResponse = {
  ok: boolean;
  text?: string;
  cached?: boolean;
  error?: string;
};

type SleeveKey =
  | "equities"
  | "fxCarry"
  | "vol"
  | "rates"
  | "commodities";

type SleeveInput = {
  key: SleeveKey;
  label: string;
  score: number;
  normalized: number;
  state:
    | "supportive"
    | "mild_supportive"
    | "mixed"
    | "mild_defensive"
    | "defensive";
  agreement: number;
  leaders: string[];
  laggards: string[];
};

export type RiskSentimentAnalysisInput = {
  regime: string;
  score: number | null;
  confidence: number | null;
  breadth: number | null;
  improving: boolean | null;
  degrading: boolean | null;
  previousScoreChange: number | null;
  londonChangeScore: number | null;
  sessionChangeScore: number | null;
  previousDaySameTimeScoreChange: number | null;
  rolling2hScoreChange: number | null;
  rolling4hScoreChange: number | null;
  updatedAt: string | null;
  summaryText: string | null;
  topSupportive: string[];
  topDefensive: string[];
  sleeves?: Record<SleeveKey, SleeveInput> | null;
  tapeQuality?:
    | "broad_supportive"
    | "narrow_supportive"
    | "mixed"
    | "defensive_divergence"
    | "broad_defensive"
    | null;
  tradeTranslation?: string | null;
  bestExpressions?: string[];
  warningFlags?: string[];
  ladderRows: Array<{
    code: string;
    name: string;
    assetClass: string;
    direction: "risk_on" | "risk_off" | "neutral";
    score: number | null;
    normalized: number | null;
    lastPrice?: number | null;
    latest: number | null;
    hour: number | null;
    daily?: number | null;
    london: number | null;
    session: number | null;
  }>;
};

function fmtNum(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return v.toFixed(2);
}

function fmtPct(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "N/A";
  return `${v.toFixed(2)}%`;
}

function labelRegime(regime: string) {
  switch (regime) {
    case "strong_risk_on":
      return "Strong Risk On";
    case "mild_risk_on":
      return "Risk On";
    case "strong_risk_off":
      return "Strong Risk Off";
    case "mild_risk_off":
      return "Risk Off";
    default:
      return "Mixed";
  }
}

function confidenceLabel(confidence: number | null) {
  if (confidence == null) return "N/A";
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.4) return "Medium";
  return "Low";
}

function labelTapeQuality(value: RiskSentimentAnalysisInput["tapeQuality"]) {
  switch (value) {
    case "broad_supportive":
      return "Broad Supportive";
    case "narrow_supportive":
      return "Narrow Supportive";
    case "defensive_divergence":
      return "Defensive Divergence";
    case "broad_defensive":
      return "Broad Defensive";
    default:
      return "Mixed";
  }
}

function buildRiskSentimentPrompt(input: RiskSentimentAnalysisInput) {
  const compact = {
    regime: input.regime,
    score: input.score,
    confidence: input.confidence,
    breadth: input.breadth,
    improving: input.improving,
    degrading: input.degrading,
    previousScoreChange: input.previousScoreChange,
    londonChangeScore: input.londonChangeScore,
    sessionChangeScore: input.sessionChangeScore,
    previousDaySameTimeScoreChange: input.previousDaySameTimeScoreChange,
    rolling2hScoreChange: input.rolling2hScoreChange,
    rolling4hScoreChange: input.rolling4hScoreChange,
    updatedAt: input.updatedAt,
    summaryText: input.summaryText,
    tapeQuality: input.tapeQuality,
    tradeTranslation: input.tradeTranslation,
    bestExpressions: input.bestExpressions,
    warningFlags: input.warningFlags,
    sleeves: input.sleeves,
    topSupportive: input.topSupportive,
    topDefensive: input.topDefensive,
    ladderRows: input.ladderRows,
  };

  const jsonBlock = JSON.stringify(compact, null, 2);

  return [
    "You are a senior macro and FX strategist helping turn an intraday risk sentiment board into actionable trade context.",
    "Use only the supplied JSON facts.",
    "Do not invent extra market data.",
    "You may infer broad implications from the direction of the assets shown.",
    "",
    "Important interpretation rules:",
    "1. Prioritise the sleeve summaries first: equities, FX carry, vol, rates, commodities.",
    "2. Tape quality matters more than isolated asset moves.",
    "3. Use best expressions and warning flags when translating to trade ideas.",
    "4. If confirmation is incomplete, say so clearly and reduce aggressiveness.",
    "5. Focus on practical trade construction, especially FX and indices where appropriate.",
    "",
    "JSON INPUT:",
    "```json",
    jsonBlock,
    "```",
    "",
    "Write the output in these exact sections:",
    "### Desk read",
    "### What is driving it",
    "### Best trade ideas",
    "### What would invalidate it",
    "",
    "Rules:",
    "- Write 8 to 12 bullets total.",
    "- Keep it concise, sharp, and trader-relevant.",
    "- Trade ideas should be practical, not vague.",
    "- Mention when the signal is not strong enough for aggressive positioning.",
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
    <div className="space-y-5">
      {blocks.map((b, i) => {
        if (b.kind === "h3") {
          return (
            <div key={i}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Section
              </div>
              <div className="mt-1 text-[18px] font-semibold text-neutral-100">
                {b.text}
              </div>
            </div>
          );
        }

        if (b.kind === "ul") {
          return (
            <ul
              key={i}
              className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-neutral-200"
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
          <p key={i} className="text-[15px] leading-7 text-neutral-200">
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
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-neutral-100">{value}</div>
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

export default function AnalyzeRiskSentimentButton({
  input,
  compact = false,
}: {
  input: RiskSentimentAnalysisInput;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string>("");
  const [cached, setCached] = React.useState<boolean | null>(null);

  async function run(forceRefresh = false): Promise<void> {
    try {
      setBusy(true);
      setError(null);

      const testPrompt = buildRiskSentimentPrompt(input);

      const body: AnalyzeRequest = {
        click: true,
        force: forceRefresh,
        noStyle: true,
        asset: "Risk Sentiment",
        code: "RISK_SENTIMENT",
        latestDate: input.updatedAt ?? null,
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
            aria-label="Analyze risk sentiment"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="border-neutral-700 bg-neutral-900 text-slate-300 hover:bg-neutral-800 hover:text-white"
            aria-label="Analyze risk sentiment"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Analyze
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className={clsx(
          "fixed right-0 top-0 h-screen w-full max-w-[980px] translate-x-0 rounded-none border-l border-neutral-800 border-t-0 border-r-0 border-b-0",
          "bg-neutral-950/96 p-0 text-neutral-100 shadow-2xl backdrop-blur",
          "flex flex-col overflow-hidden"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-800/70 bg-[linear-gradient(180deg,rgba(18,18,22,0.96),rgba(12,12,16,0.96))] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20">
                  <Sparkles className="h-4 w-4 text-fuchsia-300" />
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[20px] font-semibold text-white">
                      Risk Sentiment AI Brief
                    </span>
                    {cached !== null && (
                      <Badge
                        variant="outline"
                        className={clsx(
                          "border-neutral-700",
                          cached
                            ? "text-neutral-300"
                            : "border-emerald-700/40 text-emerald-300"
                        )}
                      >
                        {cached ? "From cache" : "Fresh"}
                      </Badge>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-neutral-400">
                    Intraday regime, sleeves, trade ideas, and invalidation points
                  </p>
                </div>
              </div>
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

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/45 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Current read
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white">
                  {labelRegime(input.regime)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
                  Confidence {confidenceLabel(input.confidence)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
                  Tape {labelTapeQuality(input.tapeQuality)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                <MetricCard label="Score" value={fmtNum(input.score)} />
                <MetricCard label="Breadth" value={fmtPct(input.breadth != null ? input.breadth * 100 : null)} />
                <MetricCard label="Since London" value={fmtNum(input.londonChangeScore)} />
                <MetricCard label="Last Update" value={fmtNum(input.previousScoreChange)} />
                <MetricCard label="2h Drift" value={fmtNum(input.rolling2hScoreChange)} />
                <MetricCard
                  label="Updated"
                  value={
                    input.updatedAt
                      ? new Date(input.updatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/45 p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <Activity className="h-3.5 w-3.5" />
                Translation
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-neutral-200">
                  {input.tradeTranslation ?? "No translation yet."}
                </div>

                <HighlightGroup
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  title="Best expressions"
                  items={input.bestExpressions ?? []}
                  tone="positive"
                />
                <HighlightGroup
                  icon={<ShieldAlert className="h-3.5 w-3.5" />}
                  title="Warning flags"
                  items={input.warningFlags ?? []}
                  tone="negative"
                />
              </div>
            </div>
          </div>

          {!!input.sleeves && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {Object.values(input.sleeves).map((sleeve) => (
                <SleeveCard key={sleeve.key} sleeve={sleeve} />
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto w-full max-w-[980px] space-y-4">
            {busy && (
              <div className="rounded-3xl border border-neutral-800/80 bg-neutral-900/40 p-5">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Building AI brief</span>
                  <ThinkingDots />
                </div>
                <div className="mt-4 space-y-3">
                  <SkeletonLine />
                  <SkeletonLine />
                  <SkeletonLine />
                  <SkeletonLine short />
                </div>
              </div>
            )}

            {!busy && error && (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
                {error}
              </div>
            )}

            {!busy && !error && text && (
              <div className="rounded-3xl border border-neutral-800/80 bg-neutral-900/40 p-6">
                <RenderBrief text={text} />
              </div>
            )}

            {!busy && !error && !text && (
              <div className="rounded-3xl border border-neutral-800/80 bg-neutral-900/40 p-5 text-sm text-neutral-400">
                No AI brief yet.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-neutral-800/70 bg-neutral-950/85 px-5 py-3">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <BarChart3 className="h-3.5 w-3.5" />
              Built from regime, sleeves, tape quality, ladder positioning, and cross-asset confirmation.
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

function HighlightGroup({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
      : "border-rose-500/20 bg-rose-500/8 text-rose-200";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
        {icon}
        {title}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white"
            >
              {item}
            </span>
          ))
        ) : (
          <span className="text-xs text-neutral-400">None notable</span>
        )}
      </div>
    </div>
  );
}

function SleeveCard({
  sleeve,
}: {
  sleeve: SleeveInput;
}) {
  const toneClass =
    sleeve.state === "supportive" || sleeve.state === "mild_supportive"
      ? "border-emerald-500/20 bg-emerald-500/8"
      : sleeve.state === "defensive" || sleeve.state === "mild_defensive"
        ? "border-rose-500/20 bg-rose-500/8"
        : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {sleeve.label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">
        {sleeve.state.replaceAll("_", " ")}
      </div>
      <div className="mt-2 text-xs text-neutral-400">
        Leaders: {sleeve.leaders.join(", ") || "—"}
      </div>
    </div>
  );
}