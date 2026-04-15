"use client";

import * as React from "react";
import {
  Activity,
  BarChart3,
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Filter,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import CotDigestAdminPanel from "@/components/admin/CotDigestAdminPanel";

type MarketContextGroupedRow = {
  asset_code: string;
  asset_class: string;
  yahoo_symbol: string;
  latest_date: string;
  latest_close: number | null;
  previous_date: string | null;
  previous_close: number | null;
  absolute_change: number | null;
  percent_change: number | null;
};

type ContextApiResponse = {
  ok: boolean;
  error?: string;
  grouped?: MarketContextGroupedRow[];
};

type CachedAnalysisRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  analysis_date: string;
  prompt_version: string;
  model: string;
  status: "processing" | "completed" | "failed";
  input_hash: string;
  result_text: string | null;
  updated_at: string;
  source: string | null;
};

type DigestRow = {
  id: string;
  analysis_date: string;
  prompt_version: string;
  digest_version: string;
  model: string;
  status: "processing" | "completed" | "failed";
  source_row_count: number;
  input_hash: string;
  source_summary: unknown;
  digest_text: string | null;
  trade_ideas_text: string | null;
  discord_text: string | null;
  posted_to_discord_at: string | null;
  discord_response: unknown;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type CotResearchApiResponse = {
  ok: boolean;
  error?: string;
  analysisDate: string | null;
  digest: DigestRow | null;
  analyses: CachedAnalysisRow[];
};

const DEFAULT_ASSET_CLASSES = ["yield", "vol", "index"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatNumber(value: number | null, digits = 2) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function changeTone(value: number | null) {
  if (value == null) return "text-neutral-400";
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-neutral-300";
}

function changePillTone(value: number | null) {
  if (value == null) return "border-white/10 bg-white/[0.03] text-neutral-300";
  if (value > 0) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (value < 0) return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  return "border-white/10 bg-white/[0.03] text-neutral-300";
}

function classBadgeTone(assetClass: string) {
  if (assetClass === "yield") {
    return "bg-amber-500/10 text-amber-200 border-amber-500/20";
  }
  if (assetClass === "vol") {
    return "bg-rose-500/10 text-rose-200 border-rose-500/20";
  }
  if (assetClass === "index") {
    return "bg-sky-500/10 text-sky-200 border-sky-500/20";
  }
  if (assetClass === "commodity") {
    return "bg-violet-500/10 text-violet-200 border-violet-500/20";
  }
  return "bg-white/5 text-neutral-200 border-white/10";
}

function extractBulletLines(text: string | null | undefined, max = 4) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.startsWith("- "))
    .slice(0, max)
    .map((x) => x.replace(/^- /, "").trim());
}

function extractSection(
  text: string | null | undefined,
  heading: string
): string {
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  const target = `### ${heading}`.toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === target);

  if (start === -1) return "";

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("### ")) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join("\n").trim();
}

function inferDeskTone(
  digest: DigestRow | null,
  contextRows: MarketContextGroupedRow[]
): {
  label: string;
  toneClass: string;
  note: string;
} {
  const text = `${digest?.digest_text ?? ""} ${digest?.trade_ideas_text ?? ""}`.toLowerCase();

  const indexPositive = contextRows.filter(
    (r) => r.asset_class === "index" && (r.percent_change ?? 0) > 0
  ).length;
  const volSupportive = contextRows.filter(
    (r) => r.asset_class === "vol" && (r.percent_change ?? 0) < 0
  ).length;

  if (indexPositive >= 4 && volSupportive >= 1) {
    return {
      label: "Supportive",
      toneClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
      note: "Macro context is broadly supportive of continuation and pro-cyclical expressions.",
    };
  }

  if (text.includes("avoid") || text.includes("crowded") || text.includes("squeeze")) {
    return {
      label: "Selective",
      toneClass: "border-amber-500/20 bg-amber-500/10 text-amber-200",
      note: "The best setups likely remain relative-value and selective rather than blanket directional trades.",
    };
  }

  return {
    label: "Balanced",
    toneClass: "border-sky-500/20 bg-sky-500/10 text-sky-200",
    note: "Signals are mixed enough that context should be treated as a filter, not a full override.",
  };
}

function getStrongestWeakest(digest: DigestRow | null) {
  const strongest = extractSection(digest?.digest_text, "Strongest currencies");
  const weakest = extractSection(digest?.digest_text, "Weakest currencies");

  return {
    strongest: extractBulletLines(strongest, 3),
    weakest: extractBulletLines(weakest, 3),
  };
}

function getTopTradeIdeas(digest: DigestRow | null) {
  return extractBulletLines(digest?.trade_ideas_text, 5);
}

function getRiskBullets(digest: DigestRow | null) {
  const risks = extractSection(digest?.trade_ideas_text, "Risks / crowded trades");
  return extractBulletLines(risks, 4);
}

function summaryInterpretationForContext(row: MarketContextGroupedRow) {
  const pct = row.percent_change ?? 0;

  if (row.asset_class === "vol") {
    if (pct < -5) return "Risk pressure easing";
    if (pct > 5) return "Risk pressure rising";
    return "Volatility stable";
  }

  if (row.asset_class === "index") {
    if (pct > 1) return "Strong equity participation";
    if (pct < -1) return "Equity tone weakening";
    return "Equity tone mixed";
  }

  if (row.asset_class === "yield") {
    if (pct > 0.5) return "Rates firming";
    if (pct < -0.5) return "Rates softening";
    return "Rates neutral";
  }

  return "Context stable";
}

function groupAnalysesByPriority(analyses: CachedAnalysisRow[]) {
  const preferredOrder = ["AUD", "EUR", "USD", "JPY", "CAD", "CHF", "GBP", "NZD", "MXN"];
  return [...analyses].sort((a, b) => {
    const ai = preferredOrder.indexOf(a.asset_code);
    const bi = preferredOrder.indexOf(b.asset_code);
    const av = ai === -1 ? 999 : ai;
    const bv = bi === -1 ? 999 : bi;
    if (av !== bv) return av - bv;
    return a.asset_code.localeCompare(b.asset_code);
  });
}

function extractMiniSignal(text: string | null | undefined) {
  if (!text) return [];
  const setup = extractBulletLines(extractSection(text, "Pair construction ideas"), 2);
  const takeaway = extractBulletLines(extractSection(text, "Trading takeaway"), 1);
  const reaction = extractBulletLines(extractSection(text, "Price reaction into release"), 1);
  return [...setup, ...reaction, ...takeaway].slice(0, 3);
}

function SectionShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm text-neutral-400">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SummaryTile({
  label,
  value,
  note,
  icon,
  tone = "border-white/10 bg-white/[0.03]",
}: {
  label: string;
  value: string;
  note?: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">
          {label}
        </div>
        {icon ? <div className="text-neutral-300">{icon}</div> : null}
      </div>
      <div className="text-lg font-semibold tracking-tight text-white">{value}</div>
      {note ? <div className="mt-1 text-xs leading-5 text-neutral-400">{note}</div> : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-sm transition",
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.05] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function AnalysisAccordion({
  row,
  defaultOpen = false,
}: {
  row: CachedAnalysisRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const signals = extractMiniSignal(row.result_text);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">{row.asset_code}</span>
            <span className="text-sm text-neutral-400">{row.asset_name}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {signals.length ? (
              signals.map((signal, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-200"
                >
                  {signal}
                </span>
              ))
            ) : (
              <span className="text-xs text-neutral-500">{row.source ?? "unknown source"}</span>
            )}
          </div>
        </div>
        <div className="mt-1 text-neutral-400">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open ? (
        <div className="border-t border-white/10 px-4 py-4">
          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
            {row.result_text ?? "No analysis text"}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function TerminalStrip({
  strongest,
  weakest,
  ideas,
  regime,
}: {
  strongest: string[];
  weakest: string[];
  ideas: string[];
  regime: string;
}) {
  const strips = [
    strongest[0] ? `Leaders: ${strongest[0]}` : "Leaders: n/a",
    weakest[0] ? `Laggards: ${weakest[0]}` : "Laggards: n/a",
    ideas[0] ? `Top idea: ${ideas[0]}` : "Top idea: n/a",
    `Regime: ${regime}`,
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
        <Sparkles size={12} />
        Terminal Strip
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {strips.map((item, i) => (
          <div
            key={i}
            className="truncate rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200"
            title={item}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMarketResearchPage() {
  const [dateFrom, setDateFrom] = React.useState(daysAgoIso(7));
  const [dateTo, setDateTo] = React.useState(todayIso());
  const [assetClasses, setAssetClasses] =
    React.useState<string[]>(DEFAULT_ASSET_CLASSES);
  const [assetCodesInput, setAssetCodesInput] = React.useState("");
  const [cotAnalysisDate, setCotAnalysisDate] = React.useState("");

  const [busyContext, setBusyContext] = React.useState(false);
  const [busyCot, setBusyCot] = React.useState(false);
  const [contextError, setContextError] = React.useState<string | null>(null);
  const [cotError, setCotError] = React.useState<string | null>(null);

  const [contextRows, setContextRows] = React.useState<MarketContextGroupedRow[]>([]);
  const [digest, setDigest] = React.useState<DigestRow | null>(null);
  const [analyses, setAnalyses] = React.useState<CachedAnalysisRow[]>([]);
  const [resolvedCotDate, setResolvedCotDate] = React.useState<string | null>(null);

  const [biasTab, setBiasTab] = React.useState<"digest" | "ideas" | "assets">("digest");
  const [contextTab, setContextTab] = React.useState<"board" | "raw">("board");
  const [alignmentTab, setAlignmentTab] = React.useState<"summary" | "prompt" | "publishing">(
    "summary"
  );

  const loadContext = React.useCallback(async () => {
    try {
      setBusyContext(true);
      setContextError(null);

      const params = new URLSearchParams({
        dateFrom,
        dateTo,
      });

      if (assetClasses.length) {
        params.set("assetClasses", assetClasses.join(","));
      }

      const assetCodes = assetCodesInput
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);

      if (assetCodes.length) {
        params.set("assetCodes", assetCodes.join(","));
      }

      const res = await fetch(
        `/api/admin/market-research/context-prices?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = (await res.json()) as ContextApiResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load market context prices");
      }

      setContextRows(json.grouped ?? []);
    } catch (err) {
      setContextError(
        err instanceof Error ? err.message : "Failed to load market context prices"
      );
      setContextRows([]);
    } finally {
      setBusyContext(false);
    }
  }, [assetClasses, assetCodesInput, dateFrom, dateTo]);

  const loadCotResearch = React.useCallback(async () => {
    try {
      setBusyCot(true);
      setCotError(null);

      const params = new URLSearchParams();
      if (cotAnalysisDate.trim()) {
        params.set("analysisDate", cotAnalysisDate.trim());
      }

      const res = await fetch(`/api/admin/market-research/cot?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json()) as CotResearchApiResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load inherited COT research");
      }

      setResolvedCotDate(json.analysisDate);
      setDigest(json.digest);
      setAnalyses(json.analyses ?? []);

      if (!cotAnalysisDate && json.analysisDate) {
        setCotAnalysisDate(json.analysisDate);
      }
    } catch (err) {
      setCotError(
        err instanceof Error ? err.message : "Failed to load inherited COT research"
      );
      setResolvedCotDate(null);
      setDigest(null);
      setAnalyses([]);
    } finally {
      setBusyCot(false);
    }
  }, [cotAnalysisDate]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  React.useEffect(() => {
    void loadCotResearch();
  }, [loadCotResearch]);

  function toggleAssetClass(assetClass: string) {
    setAssetClasses((prev) =>
      prev.includes(assetClass)
        ? prev.filter((x) => x !== assetClass)
        : [...prev, assetClass]
    );
  }

  const contextCopyPack = React.useMemo(() => {
    if (!contextRows.length) return "";

    const lines = contextRows.map((row) => {
      return [
        `${row.asset_code} (${row.asset_class})`,
        `latest ${row.latest_date}: ${formatNumber(row.latest_close, 2)}`,
        row.previous_date
          ? `previous ${row.previous_date}: ${formatNumber(row.previous_close, 2)}`
          : "previous: n/a",
        `change: ${formatNumber(row.absolute_change, 2)}`,
        `change %: ${formatNumber(row.percent_change, 2)}%`,
      ].join(" | ");
    });

    return [`Market context price pack from ${dateFrom} to ${dateTo}:`, ...lines].join("\n");
  }, [contextRows, dateFrom, dateTo]);

  const inheritedBiasPack = React.useMemo(() => {
    const parts: string[] = [];
    parts.push(`Inherited COT bias date: ${resolvedCotDate ?? "n/a"}`);

    if (digest?.digest_text) {
      parts.push("", "Desk digest:", digest.digest_text);
    }

    if (digest?.trade_ideas_text) {
      parts.push("", "Trade ideas:", digest.trade_ideas_text);
    }

    if (analyses.length) {
      parts.push("", "Per-asset cached analyses:");
      for (const row of analyses) {
        parts.push(`- ${row.asset_code} (${row.asset_name})`);
        if (row.result_text) parts.push(row.result_text);
      }
    }

    return parts.join("\n");
  }, [analyses, digest, resolvedCotDate]);

  const combinedPromptPack = React.useMemo(() => {
    const sections: string[] = [
      "You are helping me build late-week FX trade ideas.",
      "Use the inherited COT bias, the prior week price/COT interpretation, and the current market context together.",
      "Assess whether the current Mon-Wed macro context confirms or conflicts with the inherited positioning story.",
      "Then produce the best trend, pullback, or relative-value ideas for later in the week before fresh COT is released.",
      "",
      "Output:",
      "1. broad desk view",
      "2. strongest inherited themes",
      "3. whether market context confirms or weakens them",
      "4. best late-week FX trade ideas",
      "5. key risks / invalidation points",
      "",
      "=== INHERITED COT BIAS ===",
      inheritedBiasPack || "No inherited COT bias loaded.",
      "",
      "=== CURRENT MARKET CONTEXT ===",
      contextCopyPack || "No market context loaded.",
    ];

    return sections.join("\n");
  }, [contextCopyPack, inheritedBiasPack]);

  const orderedAnalyses = React.useMemo(() => groupAnalysesByPriority(analyses), [analyses]);
  const strongestWeakest = React.useMemo(() => getStrongestWeakest(digest), [digest]);
  const topIdeas = React.useMemo(() => getTopTradeIdeas(digest), [digest]);
  const topRisks = React.useMemo(() => getRiskBullets(digest), [digest]);
  const deskTone = React.useMemo(() => inferDeskTone(digest, contextRows), [digest, contextRows]);

  const contextRegime = React.useMemo(() => {
    const indexUp = contextRows.filter(
      (r) => r.asset_class === "index" && (r.percent_change ?? 0) > 0
    ).length;
    const volDown = contextRows.filter(
      (r) => r.asset_class === "vol" && (r.percent_change ?? 0) < 0
    ).length;

    if (indexUp >= 4 && volDown >= 1) return "Supportive risk tone";
    if (volDown >= 1) return "Improving volatility backdrop";
    return "Mixed macro tone";
  }, [contextRows]);

  const alignmentSummary = React.useMemo(() => {
    return [
      `Desk tone: ${deskTone.label}.`,
      strongestWeakest.strongest.length
        ? `Inherited leaders: ${strongestWeakest.strongest.join(" | ")}`
        : "Inherited leaders not extracted yet.",
      strongestWeakest.weakest.length
        ? `Inherited laggards: ${strongestWeakest.weakest.join(" | ")}`
        : "Inherited laggards not extracted yet.",
      `Current context regime: ${contextRegime}.`,
      topIdeas.length
        ? `Top late-week ideas: ${topIdeas.slice(0, 4).join(" | ")}`
        : "No trade ideas extracted yet.",
    ].join("\n\n");
  }, [contextRegime, deskTone.label, strongestWeakest, topIdeas]);

  async function copyText(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(91,33,182,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_24%),rgba(255,255,255,0.02)]">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
            <Sparkles size={12} />
            <span>Market Research Control Room</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Weekly handover and late-week trade idea workstation
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-400">
            Read inherited positioning, map the current macro regime, and build cleaner
            relative-value trade ideas before fresh COT is released.
          </p>
        </div>

        <div className="px-6 py-5">
          <TerminalStrip
            strongest={strongestWeakest.strongest}
            weakest={strongestWeakest.weakest}
            ideas={topIdeas}
            regime={contextRegime}
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <SummaryTile
              label="Inherited Date"
              value={resolvedCotDate ?? "n/a"}
              note="Digest anchor"
              icon={<CalendarDays size={14} />}
            />
            <SummaryTile
              label="Desk Tone"
              value={deskTone.label}
              note={deskTone.note}
              icon={<Brain size={14} />}
              tone={deskTone.toneClass}
            />
            <SummaryTile
              label="Context Regime"
              value={contextRegime}
              note={`${contextRows.length} assets loaded`}
              icon={<Activity size={14} />}
            />
            <SummaryTile
              label="Strongest"
              value={strongestWeakest.strongest[0] ? strongestWeakest.strongest[0].slice(0, 30) : "n/a"}
              note="Inherited leaders"
              icon={<TrendingUp size={14} />}
              tone="border-emerald-500/20 bg-emerald-500/10"
            />
            <SummaryTile
              label="Weakest"
              value={strongestWeakest.weakest[0] ? strongestWeakest.weakest[0].slice(0, 30) : "n/a"}
              note="Inherited laggards"
              icon={<TrendingDown size={14} />}
              tone="border-rose-500/20 bg-rose-500/10"
            />
            <SummaryTile
              label="Trade Ideas"
              value={String(topIdeas.length)}
              note="Extracted from digest"
              icon={<BarChart3 size={14} />}
              tone="border-sky-500/20 bg-sky-500/10"
            />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[300px,minmax(0,1fr)]">
        <aside className="xl:self-start">
          <SectionShell
            title="Research Controls"
            subtitle="Filters, dates, and reload actions."
            right={<Filter size={16} className="text-neutral-400" />}
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Analysis date
                </label>
                <input
                  type="date"
                  value={cotAnalysisDate}
                  onChange={(e) => setCotAnalysisDate(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
                />
                <p className="mt-2 text-xs text-neutral-500">
                  Leave blank to use the latest completed digest date.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    Date from
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    Date to
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Asset classes
                </label>
                <div className="flex flex-wrap gap-2">
                  {["yield", "vol", "index", "commodity"].map((assetClass) => {
                    const active = assetClasses.includes(assetClass);

                    return (
                      <button
                        key={assetClass}
                        type="button"
                        onClick={() => toggleAssetClass(assetClass)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs transition",
                          active
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-white/10 bg-white/[0.03] text-neutral-400 hover:text-white",
                        ].join(" ")}
                      >
                        {assetClass}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  Asset codes
                </label>
                <input
                  type="text"
                  value={assetCodesInput}
                  onChange={(e) => setAssetCodesInput(e.target.value)}
                  placeholder="US10Y,VIX,SPX"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => void loadCotResearch()}
                  disabled={busyCot}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={busyCot ? "animate-spin" : ""} />
                  {busyCot ? "Loading inherited bias..." : "Load inherited bias"}
                </button>

                <button
                  type="button"
                  onClick={() => void loadContext()}
                  disabled={busyContext}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={busyContext ? "animate-spin" : ""} />
                  {busyContext ? "Loading context..." : "Load market context"}
                </button>
              </div>

              {resolvedCotDate ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
                  Using inherited date:{" "}
                  <span className="font-medium text-white">{resolvedCotDate}</span>
                </div>
              ) : null}

              {digest ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-neutral-400">
                  <div>Model: {digest.model}</div>
                  <div>Rows used: {digest.source_row_count}</div>
                  <div>Status: {digest.status}</div>
                  <div>Updated: {new Date(digest.updated_at).toLocaleString()}</div>
                </div>
              ) : null}

              {cotError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {cotError}
                </div>
              ) : null}

              {contextError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {contextError}
                </div>
              ) : null}
            </div>
          </SectionShell>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr),340px]">
            <SectionShell
              title="Inherited Bias"
              subtitle="Desk digest, strongest and weakest themes, and full currency-level cached reads."
              right={
                <button
                  type="button"
                  onClick={() => void copyText(inheritedBiasPack)}
                  disabled={!inheritedBiasPack}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/[0.07] disabled:opacity-50"
                >
                  <Copy size={14} />
                  Copy bias
                </button>
              }
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <TabButton active={biasTab === "digest"} onClick={() => setBiasTab("digest")}>
                  Digest
                </TabButton>
                <TabButton active={biasTab === "ideas"} onClick={() => setBiasTab("ideas")}>
                  Trade Ideas
                </TabButton>
                <TabButton active={biasTab === "assets"} onClick={() => setBiasTab("assets")}>
                  Asset Breakdown
                </TabButton>
              </div>

              {biasTab === "digest" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {strongestWeakest.strongest.map((item, i) => (
                      <div
                        key={`s-${i}`}
                        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"
                      >
                        {item}
                      </div>
                    ))}
                    {strongestWeakest.weakest.map((item, i) => (
                      <div
                        key={`w-${i}`}
                        className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="mb-3 text-sm font-medium text-neutral-300">Desk digest</div>
                    {digest?.digest_text ? (
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                        {digest.digest_text}
                      </pre>
                    ) : (
                      <div className="text-sm text-neutral-500">No inherited desk digest loaded yet.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {biasTab === "ideas" ? (
                <div className="grid gap-4 xl:grid-cols-[1fr,320px]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="mb-3 text-sm font-medium text-neutral-300">
                      Best trade ideas from digest
                    </div>
                    {digest?.trade_ideas_text ? (
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                        {digest.trade_ideas_text}
                      </pre>
                    ) : (
                      <div className="text-sm text-neutral-500">No trade ideas section found yet.</div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-3 text-sm font-medium text-neutral-300">Top ideas</div>
                      <div className="space-y-2">
                        {topIdeas.length ? (
                          topIdeas.map((item, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
                            >
                              {item}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-neutral-500">No top ideas extracted yet.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-300">
                        <ShieldAlert size={14} />
                        Risks / crowded trades
                      </div>
                      <div className="space-y-2">
                        {topRisks.length ? (
                          topRisks.map((item, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
                            >
                              {item}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-neutral-500">No risks extracted yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {biasTab === "assets" ? (
                <div className="space-y-3">
                  {orderedAnalyses.length ? (
                    orderedAnalyses.map((row, idx) => (
                      <AnalysisAccordion key={row.id} row={row} defaultOpen={idx === 0} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-neutral-500">
                      No per-asset analyses loaded yet.
                    </div>
                  )}
                </div>
              ) : null}
            </SectionShell>

            <SectionShell
              title="Alignment Engine"
              subtitle="Fuse inherited bias and current macro regime into a usable handover."
              right={<Brain size={16} className="text-neutral-400" />}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <TabButton active={alignmentTab === "summary"} onClick={() => setAlignmentTab("summary")}>
                  Summary
                </TabButton>
                <TabButton active={alignmentTab === "prompt"} onClick={() => setAlignmentTab("prompt")}>
                  Prompt Pack
                </TabButton>
                <TabButton active={alignmentTab === "publishing"} onClick={() => setAlignmentTab("publishing")}>
                  Publishing
                </TabButton>
              </div>

              {alignmentTab === "summary" ? (
                <div className="space-y-4">
                  <div className={`rounded-2xl border p-4 ${deskTone.toneClass}`}>
                    <div className="text-sm font-medium">{deskTone.label}</div>
                    <div className="mt-1 text-sm leading-6">{deskTone.note}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 text-sm font-medium text-neutral-300">Handover summary</div>
                    <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                      {alignmentSummary}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 text-sm font-medium text-neutral-300">Late-week focus</div>
                    <div className="space-y-2">
                      {topIdeas.length ? (
                        topIdeas.slice(0, 4).map((idea, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-200"
                          >
                            {idea}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-neutral-500">No current ideas extracted.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {alignmentTab === "prompt" ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => void copyText(combinedPromptPack)}
                    disabled={!combinedPromptPack}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    <Copy size={14} />
                    Copy handover pack
                  </button>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 text-sm font-medium text-neutral-300">Combined prompt pack</div>
                    <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                      {combinedPromptPack}
                    </pre>
                  </div>
                </div>
              ) : null}

              {alignmentTab === "publishing" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
                      <Send size={14} />
                      Digest publishing
                    </div>
                    <p className="text-sm leading-6 text-neutral-400">
                      Keep the admin digest generation and Discord workflow contained here as an operator function.
                    </p>
                  </div>
                  <CotDigestAdminPanel />
                </div>
              ) : null}
            </SectionShell>
          </div>

          <SectionShell
            title="Market Context Board"
            subtitle="Read current macro regime through asset tiles and interpretation chips."
            right={
              <button
                type="button"
                onClick={() => void copyText(contextCopyPack)}
                disabled={!contextCopyPack}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                <Copy size={14} />
                Copy context
              </button>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <TabButton active={contextTab === "board"} onClick={() => setContextTab("board")}>
                Regime Board
              </TabButton>
              <TabButton active={contextTab === "raw"} onClick={() => setContextTab("raw")}>
                Raw Pack
              </TabButton>
            </div>

            {contextTab === "board" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {contextRows.length ? (
                  contextRows.map((row) => (
                    <div
                      key={row.asset_code}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-white">{row.asset_code}</div>
                          <div className="mt-1 text-xs text-neutral-500">{row.yahoo_symbol}</div>
                        </div>
                        <div
                          className={[
                            "rounded-full border px-2.5 py-1 text-[11px] capitalize",
                            classBadgeTone(row.asset_class),
                          ].join(" ")}
                        >
                          {row.asset_class}
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="text-3xl font-semibold tracking-tight text-white">
                          {formatNumber(row.latest_close, 2)}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">{row.latest_date}</div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div
                          className={[
                            "rounded-xl border px-3 py-2 text-sm font-medium",
                            changePillTone(row.percent_change),
                          ].join(" ")}
                        >
                          {formatNumber(row.percent_change, 2)}%
                        </div>
                        <div className={`text-sm font-medium ${changeTone(row.absolute_change)}`}>
                          {formatNumber(row.absolute_change, 2)}
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-300">
                        {summaryInterpretationForContext(row)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-neutral-500">
                    No market context rows found for the selected filters.
                  </div>
                )}
              </div>
            ) : null}

            {contextTab === "raw" ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 text-sm font-medium text-neutral-300">Context copy pack preview</div>
                <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                  {contextCopyPack || "No market context loaded."}
                </pre>
              </div>
            ) : null}
          </SectionShell>

          <SectionShell
            title="Operator Notes"
            subtitle="Visual and workflow cues for using the page efficiently."
            right={<FileText size={16} className="text-neutral-400" />}
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
                <div className="mb-2 font-medium text-white">1. Load both layers</div>
                Start by loading inherited bias and market context together so you can judge
                continuation versus conflict rather than reading each in isolation.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
                <div className="mb-2 font-medium text-white">2. Read summary first</div>
                Use the terminal strip, summary tiles, and alignment summary before opening raw
                prompt packs or long asset analyses.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-300">
                <div className="mb-2 font-medium text-white">3. Use raw pack last</div>
                The raw prompt pack is still available, but it should be the export layer rather
                than the main reading layer.
              </div>
            </div>
          </SectionShell>
        </div>
      </div>
    </div>
  );
}