"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, RefreshCw, Copy } from "lucide-react";
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
  releasedAt?: string | null; // ISO
};

/** Expected request body for /api/news/analyze */
type AnalyzeRequest = {
  click: true;
  force: boolean;
  noStyle: true;
  calendarEvent?: CalendarEventInput;
  /** Plain test blob when no calendarEvent is provided */
  testPrompt?: string;
};

/** Expected JSON response from /api/news/analyze */
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

  // draggable
  const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStart = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const sizeCls = compact ? "!h-6 !w-6 !p-0 !leading-none" : "h-8 w-8";

  const heading =
    calendarEvent?.indicator ??
    title ??
    (calendarEvent?.country ? `Analysis (${calendarEvent.country})` : "Analysis");

  async function run(): Promise<void> {
    try {
      setBusy(true);
      setError(null);

      const body: AnalyzeRequest = { click: true, force, noStyle: true };
      if (calendarEvent) body.calendarEvent = calendarEvent;
      if (!calendarEvent && rawText) {
        body.testPrompt = [
          title ? `Title: ${title}` : "",
          source ? `Source: ${source}` : "",
          publishedAt ? `Published: ${publishedAt}` : "",
          "",
          rawText.trim(),
        ]
          .filter(Boolean)
          .join("\n");
      }

      const res = await fetch("/api/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => ({}))) as Partial<AnalyzeResponse>;

      if (!json?.ok) {
        throw new Error(json?.error || "AI request failed");
      }

      setCached(Boolean(json.cached));
      setText(String(json.text ?? "").trim());
      onResult?.({
        ok: true,
        text: json.text ?? "",
        cached: Boolean(json.cached),
      });
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
    if (!v) setPos({ x: 0, y: 0 }); // re-center next open
  }

  // drag handlers (title bar)
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

  // beat/miss tone for the "Actual" chip
  const actualTone =
    calendarEvent?.actual != null && calendarEvent?.forecast != null
      ? calendarEvent.actual > calendarEvent.forecast
        ? "text-emerald-300"
        : calendarEvent.actual < calendarEvent.forecast
        ? "text-rose-300"
        : "text-neutral-100"
      : "text-neutral-100";

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
        className="sm:max-w-xl bg-neutral-950/95 border-neutral-800 text-neutral-100 shadow-2xl backdrop-blur"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: dragStart.current ? "none" : "transform 120ms ease-out",
        }}
      >
        <DialogHeader
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="cursor-grab active:cursor-grabbing"
        >
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20">
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
            </span>
            <span className="truncate">
              {heading}
              {calendarEvent?.country ? ` (${calendarEvent.country})` : ""}
            </span>
            {cached !== null && (
              <Badge variant="outline" className="ml-2 border-neutral-700 text-neutral-300">
                {cached ? "From cache" : "Fresh"}
              </Badge>
            )}
          </DialogTitle>

          {/* metric chips (unchanged) */}
          {calendarEvent && hasAnyValue(calendarEvent) && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[13px] text-neutral-300 sm:grid-cols-4">
              {valChip("Actual", calendarEvent.actual, calendarEvent.unit, actualTone)}
              {valChip("Forecast", calendarEvent.forecast, calendarEvent.unit)}
              {valChip("Previous", calendarEvent.previous, calendarEvent.unit)}
              {"revised" in calendarEvent ? valChip("Revised", calendarEvent.revised, calendarEvent.unit) : null}
            </div>
          )}
        </DialogHeader>

        {/* BODY: exact text, no client styling */}
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-neutral-800/60 bg-neutral-900/40 px-4 py-3">
          {busy && <div className="text-sm text-neutral-300">Analyzing…</div>}

          {!busy && error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {!busy && !error && (
            <div className="mx-auto w-full max-w-prose whitespace-pre-wrap text-[15px] leading-7 font-sans">
              {text || "—"}
            </div>
          )}
        </div>

        <DialogFooter className="mt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-neutral-400">{source && <span>Source: {source}</span>}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run()}
              className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
              size="sm"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              {busy ? "Analyzing…" : "Refresh"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (text) void navigator.clipboard?.writeText(text).catch(() => {});
              }}
              className="text-neutral-300 hover:text-neutral-100"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="text-neutral-300 hover:text-neutral-100" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------- helpers kept for chips ------- */
function hasAnyValue(ev: CalendarEventInput) {
  return ev.actual != null || ev.forecast != null || ev.previous != null || ev.revised != null;
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
function valChip(label: string, val?: number | null, unit?: string | null, valueClass?: string) {
  if (val == null) return null;
  const auto = formatValue(val, unit);
  return (
    <div className="inline-flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/40 px-2 py-1">
      <span className="text-neutral-400">{label}</span>
      <span className={clsx("font-medium", valueClass ?? "text-neutral-100")}>{auto}</span>
    </div>
  );
}
