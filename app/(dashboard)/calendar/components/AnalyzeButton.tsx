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

export type CalendarEventInput = {
  country?: string | null;
  indicator?: string | null;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  revised?: number | null;
  unit?: string | null;
  releasedAt?: string | null;
};

type AnalyzeRequest = {
  click: true;
  force: boolean;
  noStyle: true;
  testPrompt?: string;
};

export type AnalyzeResponse = {
  ok: boolean;
  text?: string;
  cached?: boolean;
  error?: string;
};

type AnalyzeButtonProps = {
  calendarEvent?: CalendarEventInput;
  rawText?: string;
  title?: string;
  source?: string;
  publishedAt?: string;

  compact?: boolean;
  triggerClassName?: string;
  force?: boolean;
  onResult?: (payload: AnalyzeResponse) => void;
};

const CCY_TO_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  JPY: "JP",
  CNY: "CN",
  AUD: "AU",
  NZD: "NZ",
  CAD: "CA",
  CHF: "CH",
  SEK: "SE",
  NOK: "NO",
  DKK: "DK",
  MXN: "MX",
  ZAR: "ZA",
  INR: "IN",
  RUB: "RU",
  BRL: "BR",
  TRY: "TR",
  KRW: "KR",
  HKD: "HK",
  SGD: "SG",
};

function countryFromMaybeCurrency(code?: string | null): string | null {
  const s = (code ?? "").trim().toUpperCase();
  if (!s) return null;
  return CCY_TO_COUNTRY[s] ?? s;
}

function fmtUnit(n?: number | null, unit?: string | null): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if ((unit ?? "").trim() === "%") {
    const v = n * 100;
    return (
      (Math.abs(v) < 10 ? v.toFixed(2) : Math.abs(v) < 100 ? v.toFixed(1) : Math.round(v).toString()) + "%"
    );
  }
  const abs = Math.abs(n);
  const trim = (v: number) => (Math.abs(v) < 10 ? v.toFixed(2) : Math.abs(v) < 100 ? v.toFixed(1) : Math.round(v).toString());
  let out = "";
  if (abs >= 1e12) out = trim(n / 1e12) + "T";
  else if (abs >= 1e9) out = trim(n / 1e9) + "B";
  else if (abs >= 1e6) out = trim(n / 1e6) + "M";
  else if (abs >= 1e3) out = trim(n / 1e3) + "K";
  else out = trim(n);
  return unit && unit !== "—" ? `${out} ${unit}` : out;
}

function pctSurprise(actual?: number | null, ref?: number | null): string {
  if (actual == null || ref == null || !Number.isFinite(actual) || !Number.isFinite(ref) || ref === 0) return "N/A";
  const pct = ((actual - ref) / Math.abs(ref)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function pickPairs(country: string) {
  switch (country) {
    case "GB":
      return "GBPUSD, EURGBP, GBPJPY, FTSE 100, UK Gilts";
    case "US":
      return "EURUSD, GBPUSD, USDJPY, S&P 500, UST 2y/10y";
    case "EU":
      return "EURUSD, EURGBP, EURJPY, EuroStoxx 50, Bunds";
    case "JP":
      return "USDJPY, EURJPY, GBPJPY, Nikkei 225, JGBs";
    case "CN":
      return "USDCNH, AUDUSD, NZDUSD, Copper, CSI 300";
    default:
      return "USD Index (DXY), Gold, S&P 500, Crude";
  }
}

function buildStructuredBriefPrompt(
  ev?: CalendarEventInput,
  rawText?: string,
  meta?: { title?: string; source?: string; publishedAt?: string }
) {
  const country = countryFromMaybeCurrency(ev?.country) ?? null;
  const indicator = ev?.indicator?.trim() || null;
  const unit = ev?.unit?.trim() || null;
  const actual = Number.isFinite(ev?.actual as number) ? ev?.actual : null;
  const forecast = Number.isFinite(ev?.forecast as number) ? ev?.forecast : null;
  const previous = Number.isFinite(ev?.previous as number) ? ev?.previous : null;
  const releasedAt = ev?.releasedAt || null;

  const ref = forecast ?? previous ?? null;
  const surprise = pctSurprise(actual ?? null, ref);

  const jsonBlock = JSON.stringify(
    {
      country,
      indicator,
      unit,
      actual,
      forecast,
      previous,
      releasedAt,
      derived: { surprise },
    },
    null,
    2
  );

  const pairs = pickPairs(country ?? "XX");

  if (!ev && rawText) {
    return [
      "You are a macro strategist. Summarize and trade-brief the following item.",
      meta?.title ? `Title: ${meta.title}` : "",
      meta?.source ? `Source: ${meta.source}` : "",
      meta?.publishedAt ? `Published: ${meta.publishedAt}` : "",
      "",
      rawText.trim(),
      "",
      "Write sections:",
      "### What it is",
      "### Latest numbers",
      "### Why it matters",
      "### Likely impact",
      "### Price action plan",
      "### Timing windows",
      "Be concrete and concise for intraday traders.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "You are a macro strategist writing a concise trading brief. Use ONLY the provided JSON facts. Do not invent data.",
    "",
    "JSON (facts to use exactly):",
    "```json",
    jsonBlock,
    "```",
    "",
    "Instructions:",
    "- If a field is null or N/A, state that and avoid speculation.",
    "- Numbers already include units/format in the JSON-derived bullets you will write.",
    "",
    "Write the brief in these sections (6–10 bullets total):",
    "### What it is",
    `Explain what **${indicator ?? "the indicator"}** measures for ${country ?? "the country"} in 1–2 bullets.`,
    "### Latest numbers",
    `Use: Actual=${fmtUnit(actual ?? null, unit)}, Forecast=${fmtUnit(forecast ?? null, unit)}, Previous=${fmtUnit(
      previous ?? null,
      unit
    )}, Surprise=${surprise}. Say above/below/in-line if determinable.`,
    "### Why it matters",
    "Connect to growth/inflation/labour or central bank implications as appropriate.",
    "### Likely impact",
    `Pairs/instruments to watch: ${pairs}. Indicate directional bias (firm/soft) based on the numbers if applicable.`,
    "### Price action plan",
    "Give 3–4 concise bullets: first spike vs fade/continuation, top-of-hour bursts, levels (prior H/L, session HOD/LOD, VWAP devs), risk (slippage/spreads/initial stops).",
    "### Timing windows",
    "Immediate (0–5m), follow-through (5–15m), London–NY overlap (12:00–16:00 UTC) where relevant.",
  ].join("\n");
}

/* ----------------------------- renderer ----------------------------- */
function RenderBrief({ text }: { text: string }) {
  const blocks = React.useMemo(() => {
    const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");

    type Block = { kind: "h3"; text: string } | { kind: "ul"; items: string[] } | { kind: "p"; text: string };

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
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Section</div>
              <div className="text-base font-semibold text-neutral-100">{b.text}</div>
            </div>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc pl-5 text-sm leading-6 text-neutral-200 space-y-1">
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

/* -------------------------------- component -------------------------------- */
export default function AnalyzeButton({
  calendarEvent,
  rawText,
  title,
  source,
  publishedAt,
  compact = false,
  triggerClassName = "",
  force = false,
  onResult,
}: AnalyzeButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string>("");
  const [cached, setCached] = React.useState<boolean | null>(null);

  const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStart = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [showPayload, setShowPayload] = React.useState(false);

  const sizeCls = compact ? "!h-6 !w-6 !p-0 !leading-none" : "h-8 w-8";
  const heading =
    calendarEvent?.indicator ?? title ?? (calendarEvent?.country ? `Analysis (${calendarEvent.country})` : "AI Analysis");

  async function run(): Promise<void> {
    try {
      setBusy(true);
      setError(null);

      const testPrompt = buildStructuredBriefPrompt(calendarEvent, rawText, { title, source, publishedAt });
      const body: AnalyzeRequest = { click: true, force, noStyle: true, testPrompt };

      if (showPayload) {
        // eslint-disable-next-line no-console
        console.log("[AnalyzeButton] Sending body:", body);
      }

      const res = await fetch("/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => ({}))) as Partial<AnalyzeResponse>;
      if (!json?.ok) throw new Error(json?.error || "AI request failed");

      setCached(Boolean(json.cached));
      setText(String(json.text ?? "").trim());
      onResult?.({ ok: true, text: json.text ?? "", cached: Boolean(json.cached) });
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI request failed";
      setError(message);
      onResult?.({ ok: false, error: message });
    } finally {
      setBusy(false);
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v && !text && !busy) void run();
    if (!v) setPos({ x: 0, y: 0 });
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  }
  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    dragStart.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const actualTone =
    calendarEvent?.actual != null && calendarEvent?.forecast != null
      ? calendarEvent.actual > calendarEvent.forecast
        ? "text-emerald-300"
        : calendarEvent.actual < calendarEvent.forecast
          ? "text-rose-300"
          : "text-neutral-100"
      : "text-neutral-100";

  const canCopy = Boolean(text && text.trim().length);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenChange(true);
          }}
          className={clsx(
            `${sizeCls} relative overflow-visible rounded-full`,
            "border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800/80",
            "text-fuchsia-300 transition-all",
            triggerClassName
          )}
          title="Analyze"
          aria-label="Analyze"
        >
          <Sparkles className="h-4 w-4 relative z-10" />
        </Button>
      </DialogTrigger>

      <DialogContent
        data-dialog-content
        className={clsx(
          "sm:max-w-2xl p-0",
          "bg-neutral-950/95 border-neutral-800 text-neutral-100 shadow-2xl backdrop-blur",
          "flex flex-col",
          "h-[85vh] overflow-hidden"
        )}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: dragStart.current ? "none" : "transform 120ms ease-out",
        }}
      >
        {/* Header (drag handle) */}
        <DialogHeader
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={clsx(
            "cursor-grab active:cursor-grabbing",
            "border-b border-neutral-800/70",
            "bg-neutral-950/70 backdrop-blur",
            "px-5 py-4"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="flex items-center gap-3 text-base sm:text-lg min-w-0">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20">
                <Sparkles className="h-4 w-4 text-fuchsia-300" />
              </span>

              <span className="min-w-0">
                <span className="block truncate font-semibold">{heading}</span>
                <span className="mt-0.5 block text-xs text-neutral-400 truncate">
                  {source ? `Source: ${source}` : "AI macro brief"}
                  {publishedAt ? ` • ${publishedAt}` : ""}
                </span>
              </span>

              {cached !== null && (
                <Badge
                  variant="outline"
                  className={clsx(
                    "ml-2 border-neutral-700",
                    cached ? "text-neutral-300" : "text-emerald-300 border-emerald-700/40"
                  )}
                >
                  {cached ? "From cache" : "Fresh"}
                </Badge>
              )}
            </DialogTitle>

            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-neutral-300 hover:text-neutral-100" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>

          {calendarEvent && hasAnyValue(calendarEvent) && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard label="Actual" value={calendarEvent.actual} unit={calendarEvent.unit} valueClass={actualTone} />
              <MetricCard label="Forecast" value={calendarEvent.forecast} unit={calendarEvent.unit} />
              <MetricCard label="Previous" value={calendarEvent.previous} unit={calendarEvent.unit} />
              {"revised" in calendarEvent ? <MetricCard label="Revised" value={calendarEvent.revised} unit={calendarEvent.unit} /> : null}
            </div>
          )}
        </DialogHeader>

        {/* Body (ONLY scroll area) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-900/35 p-4 sm:p-5">
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
              <div className="mx-auto w-full max-w-prose">
                {text ? <RenderBrief text={text} /> : <div className="text-sm text-neutral-400">—</div>}
              </div>
            )}

            <details className="mt-5 text-xs text-neutral-400">
              <summary
                className="cursor-pointer select-none"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPayload((v) => !v);
                }}
              >
                {showPayload ? "Hide" : "Show"} payload preview
              </summary>
              {showPayload && (
                <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-[11px] leading-5">
                  {JSON.stringify(
                    {
                      promptPreview:
                        buildStructuredBriefPrompt(calendarEvent, rawText, { title, source, publishedAt }).slice(0, 1200) + "…",
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </details>
          </div>
        </div>

        {/* Footer (fixed, never overlays) */}
        <DialogFooter className="border-t border-neutral-800/70 bg-neutral-950/70 backdrop-blur px-5 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-[11px] text-neutral-500">Use this with session flow + your playbook.</div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run()}
                className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                size="sm"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                {busy ? "Thinking…" : "Refresh"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                disabled={!canCopy}
                onClick={() => {
                  if (text) void navigator.clipboard?.writeText(text).catch(() => {});
                }}
                className={clsx("text-neutral-300 hover:text-neutral-100", !canCopy && "opacity-50")}
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

/* ----------------------------- UI helpers ----------------------------- */
function MetricCard({
  label,
  value,
  unit,
  valueClass,
}: {
  label: string;
  value?: number | null;
  unit?: string | null;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800/70 bg-neutral-900/35 px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={clsx("mt-0.5 text-sm font-semibold tabular-nums", value == null ? "text-neutral-600" : valueClass ?? "text-neutral-100")}>
        {value == null ? "—" : formatValue(value, unit)}
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

/* ----------------------------- value helpers ----------------------------- */
function hasAnyValue(ev: CalendarEventInput) {
  return ev.actual != null || ev.forecast != null || ev.previous != null || ev.revised != null || !!ev.indicator || !!ev.country;
}
function trimDp(n: number) {
  const s = Math.abs(n) < 10 ? n.toFixed(2) : Math.abs(n) < 100 ? n.toFixed(1) : Math.round(n).toString();
  return s.replace(/\.0+$/, "");
}
function isPercentUnit(u?: string | null): boolean {
  return !!u && ["%", "percent", "percentage", "pct"].includes(u?.trim().toLowerCase());
}
function isCurrencyCode(u?: string | null): boolean {
  return !!u && /^[A-Z]{3}$/.test(u?.trim());
}
function isCurrencySymbol(u?: string | null): boolean {
  return !!u && /[$€£¥]/.test(u?.trim());
}
function formatValue(n: number, unit?: string | null) {
  const abs = Math.abs(n);
  const preferAbbrev = isCurrencyCode(unit) || isCurrencySymbol(unit) || abs >= 1e6;
  let out: string;
  if (preferAbbrev) {
    if (abs >= 1e12) out = `${trimDp(n / 1e12)}T`;
    else if (abs >= 1e9) out = `${trimDp(n / 1e9)}B`;
    else if (abs >= 1e6) out = `${trimDp(n / 1e6)}M`;
    else if (abs >= 1e3) out = `${trimDp(n / 1e3)}K`;
    else out = trimDp(n);
  } else {
    out = Intl.NumberFormat().format(n);
  }
  if (isPercentUnit(unit)) return `${out}%`;
  if (isCurrencySymbol(unit)) return `${out} ${unit?.trim()}`;
  if (isCurrencyCode(unit)) return `${out} ${unit?.trim()}`;
  return unit && unit !== "—" ? `${out} ${unit}` : out;
}