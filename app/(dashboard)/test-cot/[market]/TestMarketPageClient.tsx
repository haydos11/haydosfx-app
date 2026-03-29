"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import CotCharts from "@/app/(dashboard)/cot/components/CotCharts";
import AnalyzeCotButton from "./AnalyzeCotButton";

type RecentRow = {
  date: string;
  open_interest: number | null;
  large_spec_net: number;
  large_spec_long?: number | null;
  large_spec_short?: number | null;
  small_traders_net: number;
  commercials_net: number;
  report_price?: number | null;
  release_price?: number | null;

  indexed_report_price?: number | null;
  indexed_release_price?: number | null;

  bias?: string | null;
  positioning?: string | null;
  move_pct_report_to_release?: number | null;
  price_direction?: string | null;
  reaction_type?: string | null;
  large_spec_net_usd?: number | null;
  small_traders_net_usd?: number | null;
  commercials_net_usd?: number | null;
  d_large?: number;
  d_large_long?: number;
  d_large_short?: number;
  d_small?: number;
  d_comm?: number;
  d_oi?: number;
  d_large_usd?: number;
  d_small_usd?: number;
  d_comm_usd?: number;
};

type MarketApiResponse = {
  market: {
    key: string;
    code: string;
    name: string;
    dbCode?: string;
    isFx?: boolean;
    fx_symbol?: string | null;
    price_symbol?: string | null;
  };
  dates: string[];
  large: number[];
  small: number[];
  comm: number[];
  ls_large: number[];
  ls_small: number[];
  ls_comm: number[];
  open_interest: (number | null)[];
  report_price?: (number | null)[];
  release_price?: (number | null)[];
  indexed_report_price?: (number | null)[];
  indexed_release_price?: (number | null)[];
  large_usd?: (number | null)[];
  small_usd?: (number | null)[];
  comm_usd?: (number | null)[];
  bias?: (number | string | null)[];
  positioning?: (string | null)[];
  move_pct?: (number | null)[];
  price_direction?: (string | null)[];
  reaction?: (string | null)[];
  recent: RecentRow[];
  updated: string;
  range?: { label?: string };
};

const RANGES = ["1y", "ytd", "3y", "5y", "max"] as const;
const RECENT_ROW_OPTIONS = [12, 26, 52] as const;

function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString();
}

function fmtSignedNum(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString()}`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtPctUnsigned(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v.toFixed(2)}%`;
}

function fmtPx(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(5);
}

function fmtUsd(v: number | null | undefined) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function pillClasses(tone: "neutral" | "up" | "down" | "warn" = "neutral") {
  const map = {
    neutral: "bg-white/6 text-slate-300 ring-white/10",
    up: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    down: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    warn: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  } as const;

  return [
    "inline-flex items-center rounded-full ring-1",
    "px-2 py-0.5 text-[10px] font-medium",
    map[tone],
  ].join(" ");
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "up" | "down" | "warn";
  children: React.ReactNode;
}) {
  return <span className={pillClasses(tone)}>{children}</span>;
}

function toneFromBias(v: string | null | undefined): "neutral" | "up" | "down" {
  if (v === "bullish") return "up";
  if (v === "bearish") return "down";
  return "neutral";
}

function toneFromReaction(v: string | null | undefined): "neutral" | "up" | "warn" {
  if (v === "confirmation") return "up";
  if (v === "fade") return "warn";
  return "neutral";
}

function deltaToneClass(v: number | null | undefined) {
  if (v == null || v === 0) return "text-slate-400";
  return v > 0 ? "text-emerald-300" : "text-rose-300";
}

function deltaIcon(v: number | null | undefined) {
  if (v == null || v === 0) return "•";
  return v > 0 ? "▲" : "▼";
}

function toneFromPositioningShift(
  bias: string | null | undefined,
  delta: number | null | undefined
): "neutral" | "up" | "down" | "warn" {
  if (!bias || delta == null || delta === 0) return "neutral";
  if (bias === "bullish") return delta > 0 ? "up" : "warn";
  if (bias === "bearish") return delta < 0 ? "down" : "warn";
  return "neutral";
}

function positioningShiftLabel(
  bias: string | null | undefined,
  delta: number | null | undefined
) {
  if (!bias) return "Neutral";
  if (delta == null || delta === 0) {
    if (bias === "bullish") return "Flat Bullish";
    if (bias === "bearish") return "Flat Bearish";
    return "Neutral";
  }
  if (bias === "bullish") return delta > 0 ? "Increasing Bullish" : "Less Bullish";
  if (bias === "bearish") return delta < 0 ? "Increasing Bearish" : "Less Bearish";
  return "Neutral";
}

function reactionHelpText(isFx: boolean) {
  if (isFx) {
    return "For FX markets, the move is calculated from the indexed currency view rather than the raw pair quote. Confirmation means the indexed currency moved in the same direction as positioning into release. Fade means it moved against the positioning read.";
  }

  return "Confirmation means price moved in the same direction as positioning into release. Fade means price moved against the positioning read into release, suggesting divergence, squeeze, or distribution.";
}

function reportPriceHelpText(isFx: boolean) {
  if (isFx) {
    return "For FX markets, this is a basket-based indexed currency view rather than the raw pair quote. It reflects the underlying currency’s broader strength across multiple FX pairs and is used for report-to-release reaction analysis. USD notionals are calculated separately from contract pricing.";
  }

  return "For non-FX markets, this is the stored report-date market price used for the positioning and reaction view.";
}

function grossPositionHelpText() {
  return "Gross positioning is large spec longs plus large spec shorts. It shows depth of participation even when net positioning looks small.";
}

function netPctGrossHelpText() {
  return "Net % Gross = net contracts divided by gross contracts. It shows how directional positioning is relative to the total depth of large spec participation.";
}

function rangeHelpText(label: string) {
  return `${label} compares the current reading to the last 52 weeks of data visible on this page.`;
}

function getDisplayReportPrice(row: RecentRow, isFx: boolean) {
  return isFx ? (row.indexed_report_price ?? row.report_price) : row.report_price;
}

function getDisplayReleasePrice(row: RecentRow, isFx: boolean) {
  return isFx ? (row.indexed_release_price ?? row.release_price) : row.release_price;
}

function buildRead(latest: RecentRow | null, code: string, isFx: boolean) {
  if (!latest || !latest.bias) return null;

  const shift = latest.positioning ?? positioningShiftLabel(latest.bias, latest.d_large);
  const displayReportPrice = getDisplayReportPrice(latest, isFx);

  if (latest.reaction_type) {
    const move = latest.move_pct_report_to_release;
    const moveTxt = move == null ? "—" : `${move > 0 ? "+" : ""}${move.toFixed(2)}%`;

    if (latest.reaction_type === "confirmation") {
      return `${code} positioning remains ${latest.bias} (${shift}) and price confirmed into release (${moveTxt}).`;
    }

    if (latest.reaction_type === "fade") {
      return `${code} positioning remains ${latest.bias} (${shift}) but price faded into release (${moveTxt}), suggesting divergence or squeeze.`;
    }
  }

  const reportPriceTxt = displayReportPrice == null ? "—" : fmtPx(displayReportPrice);
  const usdTxt = fmtUsd(latest.large_spec_net_usd);

  return `${code} positioning remains ${latest.bias} (${shift}). Latest report price ${reportPriceTxt} with large spec USD notional at ${usdTxt}.`;
}

function CellStack({
  top,
  bottom,
  topClass = "text-slate-100",
  bottomClass = "text-slate-400",
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  topClass?: string;
  bottomClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className={`tabular-nums ${topClass}`}>{top}</div>
      <div className={`mt-0.5 text-xs ${bottomClass}`}>{bottom}</div>
    </div>
  );
}

function DeltaLine({
  value,
  formatter = fmtSignedNum,
  className = "",
}: {
  value: number | null | undefined;
  formatter?: (v: number | null | undefined) => string;
  className?: string;
}) {
  const color = deltaToneClass(value);

  return (
    <span className={`inline-flex items-center gap-1 ${color} ${className}`}>
      <span className="text-[10px]">{deltaIcon(value)}</span>
      <span>{formatter(value)}</span>
    </span>
  );
}

function InlineValueWithDelta({
  value,
  delta,
  valueFormatter,
  deltaFormatter = fmtSignedNum,
  valueClass = "text-slate-100",
}: {
  value: number | null | undefined;
  delta: number | null | undefined;
  valueFormatter: (v: number | null | undefined) => string;
  deltaFormatter?: (v: number | null | undefined) => string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={`tabular-nums ${valueClass}`}>{valueFormatter(value)}</span>
      <DeltaLine
        value={delta}
        formatter={deltaFormatter}
        className="text-[11px] leading-none"
      />
    </div>
  );
}

function TooltipInfo({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-200"
        aria-label="More information"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-80 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs leading-5 text-slate-300 shadow-2xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

function PositioningCell({ row }: { row: RecentRow }) {
  const shiftLabel =
    row.positioning ?? positioningShiftLabel(row.bias, row.d_large);
  const shiftTone = toneFromPositioningShift(row.bias, row.d_large);

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        className={[
          "text-sm font-medium",
          row.bias === "bullish"
            ? "text-emerald-300"
            : row.bias === "bearish"
            ? "text-rose-300"
            : "text-slate-300",
        ].join(" ")}
      >
        {row.bias
          ? row.bias.charAt(0).toUpperCase() + row.bias.slice(1)
          : "—"}
      </span>

      <Badge tone={shiftTone}>{shiftLabel}</Badge>
    </div>
  );
}

function StatCard({
  label,
  value,
  subvalue,
  help,
  valueClass = "text-slate-100",
}: {
  label: string;
  value: React.ReactNode;
  subvalue?: React.ReactNode;
  help?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        {help ? <TooltipInfo text={help} /> : null}
      </div>
      <div className={`mt-2 text-lg font-semibold ${valueClass}`}>{value}</div>
      {subvalue ? <div className="mt-1 text-xs text-slate-400">{subvalue}</div> : null}
    </div>
  );
}

export default function TestMarketPageClient({
  market,
  range,
}: {
  market: string;
  range: string;
}) {
  const [data, setData] = useState<MarketApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const recentRowsParam = useMemo(() => {
    const raw = Number(searchParams?.get("recent") ?? "12");
    return RECENT_ROW_OPTIONS.includes(raw as (typeof RECENT_ROW_OPTIONS)[number])
      ? (raw as (typeof RECENT_ROW_OPTIONS)[number])
      : 12;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(
          `/api/cot/test-market/${encodeURIComponent(market)}?range=${encodeURIComponent(
            range
          )}&recent=${encodeURIComponent(String(recentRowsParam))}&v=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const json = (await res.json()) as MarketApiResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof Error ? error.message : "Failed to load market");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [market, range, recentRowsParam]);

  function setRange(nextRange: string) {
    const sp = new URLSearchParams(searchParams?.toString());
    sp.set("range", nextRange);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  function setRecentRows(nextRows: number) {
    const sp = new URLSearchParams(searchParams?.toString());
    sp.set("recent", String(nextRows));
    router.replace(`${pathname}?${sp.toString()}`);
  }

  const analysisInput = useMemo(() => {
    if (!data || !data.recent?.length) return null;

    const latest = data.recent[0];
    const isFx = Boolean(data.market.isFx);

    const latestLong = latest.large_spec_long ?? null;
    const latestShort = latest.large_spec_short ?? null;

    const grossContracts =
      latestLong != null && latestShort != null ? latestLong + latestShort : null;

    const netPctOi =
      latest.open_interest != null &&
      latest.open_interest !== 0 &&
      latest.large_spec_net != null
        ? (latest.large_spec_net / latest.open_interest) * 100
        : null;

    const netPctGross =
      grossContracts != null &&
      grossContracts !== 0 &&
      latest.large_spec_net != null
        ? (latest.large_spec_net / grossContracts) * 100
        : null;

    const latestDisplayReportPrice = getDisplayReportPrice(latest, isFx);
    const latestDisplayReleasePrice = getDisplayReleasePrice(latest, isFx);

    const netSeries = data.large.filter((v) => Number.isFinite(v));
    const usdSeries = (data.large_usd ?? []).filter(
      (v): v is number => v != null && Number.isFinite(v)
    );
    const oiSeries = data.open_interest.filter(
      (v): v is number => v != null && Number.isFinite(v)
    );

    const net52wHigh = netSeries.length ? Math.max(...netSeries) : null;
    const net52wLow = netSeries.length ? Math.min(...netSeries) : null;
    const usd52wHigh = usdSeries.length ? Math.max(...usdSeries) : null;
    const usd52wLow = usdSeries.length ? Math.min(...usdSeries) : null;
    const oi52wAvg = oiSeries.length
      ? oiSeries.reduce((sum, v) => sum + v, 0) / oiSeries.length
      : null;

    const oiVsAvgPct =
      latest.open_interest != null && oi52wAvg != null && oi52wAvg !== 0
        ? ((latest.open_interest - oi52wAvg) / oi52wAvg) * 100
        : null;

    const netRangePct =
      latest.large_spec_net != null &&
      net52wHigh != null &&
      net52wLow != null &&
      net52wHigh !== net52wLow
        ? ((latest.large_spec_net - net52wLow) / (net52wHigh - net52wLow)) * 100
        : null;

    const latestLargeUsd = latest.large_spec_net_usd ?? null;

    const usdRangePct =
      latestLargeUsd != null &&
      usd52wHigh != null &&
      usd52wLow != null &&
      usd52wHigh !== usd52wLow
        ? ((latestLargeUsd - usd52wLow) / (usd52wHigh - usd52wLow)) * 100
        : null;

    const latestLongRaw =
      data.ls_large?.length ? data.ls_large[data.ls_large.length - 1] : null;

    const latestShortRaw =
      latestLongRaw != null && Number.isFinite(latestLongRaw)
        ? latestLongRaw !== 0
          ? 100 / (1 + latestLongRaw)
          : null
        : null;

    const longPct =
      latestLongRaw != null && Number.isFinite(latestLongRaw)
        ? (latestLongRaw / (1 + latestLongRaw)) * 100
        : null;

    const shortPct =
      latestShortRaw != null && Number.isFinite(latestShortRaw)
        ? latestShortRaw
        : null;

    return {
      asset: data.market.name,
      code: data.market.code,
      group: null,
      range,
      latestDate: latest.date,
      isFx,

      latestNet: latest.large_spec_net,
      prevNet:
        latest.d_large != null ? latest.large_spec_net - latest.d_large : null,
      weeklyChange: latest.d_large ?? null,

      longPct,
      shortPct,
      netPctOi,
      openInterest: latest.open_interest,

      latestLarge: latest.large_spec_net,
      latestSmall: latest.small_traders_net,
      latestComm: latest.commercials_net,

      largeLong: latest.large_spec_long ?? null,
      largeShort: latest.large_spec_short ?? null,
      grossContracts,
      netPctGross,

      weeklyLongChange: latest.d_large_long ?? null,
      weeklyShortChange: latest.d_large_short ?? null,
      weeklyOiChange: latest.d_oi ?? null,

      latestLargeUsd: latest.large_spec_net_usd ?? null,
      latestSmallUsd: latest.small_traders_net_usd ?? null,
      latestCommUsd: latest.commercials_net_usd ?? null,
      weeklyLargeUsdChange: latest.d_large_usd ?? null,
      weeklySmallUsdChange: latest.d_small_usd ?? null,
      weeklyCommUsdChange: latest.d_comm_usd ?? null,

      reportPrice: latest.report_price ?? null,
      releasePrice: latest.release_price ?? null,
      indexedReportPrice: latestDisplayReportPrice ?? null,
      indexedReleasePrice: latestDisplayReleasePrice ?? null,
      movePct: latest.move_pct_report_to_release ?? null,
      priceDirection: latest.price_direction ?? null,
      reactionType: latest.reaction_type ?? null,

      net52wHigh,
      net52wLow,
      netRangePct,

      usd52wHigh,
      usd52wLow,
      usdRangePct,

      oi52wAvg,
      oiVsAvgPct,

      notes:
        "Derived from DB-backed COT market page with speculative positioning depth, 52-week context, USD notionals, and report-to-release price reaction. For FX, indexed currency prices should be prioritised over raw pair prices when interpreting confirmation/fade and broader underlying currency strength.",
    };
  }, [data, range]);

  const latest = data?.recent?.[0] ?? null;
  const isFx = Boolean(data?.market.isFx);
  const narrative = buildRead(latest, data?.market.code ?? "", isFx);
  const latestShift = latest
    ? latest.positioning ?? positioningShiftLabel(latest.bias, latest.d_large)
    : "Neutral";

  const latestDisplayReportPrice = latest ? getDisplayReportPrice(latest, isFx) : null;
  const latestDisplayReleasePrice = latest ? getDisplayReleasePrice(latest, isFx) : null;

  const derivedStats = useMemo(() => {
    if (!data || !latest) return null;

    const latestLong = latest.large_spec_long ?? null;
    const latestShort = latest.large_spec_short ?? null;
    const latestNet = latest.large_spec_net ?? null;
    const latestOi = latest.open_interest ?? null;
    const latestUsd = latest.large_spec_net_usd ?? null;

    const grossContracts =
      latestLong != null && latestShort != null ? latestLong + latestShort : null;

    const netPctGross =
      grossContracts && latestNet != null ? (latestNet / grossContracts) * 100 : null;

    const netPctOi =
      latestOi && latestNet != null ? (latestNet / latestOi) * 100 : null;

    const netSeries = data.large.filter((v) => Number.isFinite(v));
    const usdSeries = (data.large_usd ?? []).filter(
      (v): v is number => v != null && Number.isFinite(v)
    );
    const oiSeries = data.open_interest.filter(
      (v): v is number => v != null && Number.isFinite(v)
    );

    const net52wHigh = netSeries.length ? Math.max(...netSeries) : null;
    const net52wLow = netSeries.length ? Math.min(...netSeries) : null;
    const usd52wHigh = usdSeries.length ? Math.max(...usdSeries) : null;
    const usd52wLow = usdSeries.length ? Math.min(...usdSeries) : null;
    const oi52wAvg = oiSeries.length
      ? oiSeries.reduce((sum, v) => sum + v, 0) / oiSeries.length
      : null;

    const oiVsAvg =
      latestOi != null && oi52wAvg != null && oi52wAvg !== 0
        ? ((latestOi - oi52wAvg) / oi52wAvg) * 100
        : null;

    const netRangePct =
      latestNet != null &&
      net52wHigh != null &&
      net52wLow != null &&
      net52wHigh !== net52wLow
        ? ((latestNet - net52wLow) / (net52wHigh - net52wLow)) * 100
        : null;

    const usdRangePct =
      latestUsd != null &&
      usd52wHigh != null &&
      usd52wLow != null &&
      usd52wHigh !== usd52wLow
        ? ((latestUsd - usd52wLow) / (usd52wHigh - usd52wLow)) * 100
        : null;

    return {
      latestLong,
      latestShort,
      latestNet,
      latestOi,
      latestUsd,
      grossContracts,
      netPctGross,
      netPctOi,
      net52wHigh,
      net52wLow,
      usd52wHigh,
      usd52wLow,
      oi52wAvg,
      oiVsAvg,
      netRangePct,
      usdRangePct,
    };
  }, [data, latest]);

  if (loading) {
    return <div className="p-4 text-sm text-slate-400">Loading…</div>;
  }

  if (err || !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-rose-300">
        {err ?? "Failed to load market"}
      </div>
    );
  }

  const series = {
    market: data.market,
    dates: data.dates,
    large: data.large,
    small: data.small,
    comm: data.comm,
    ls_large: data.ls_large,
    ls_small: data.ls_small,
    ls_comm: data.ls_comm,
    open_interest: data.open_interest,
    recent: data.recent,
    updated: data.updated,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/test-cot"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Test COT</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              DB-backed market detail
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-100">
              {data.market.name} ({data.market.code})
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {isFx && data.market.fx_symbol
                ? `FX symbol: ${data.market.fx_symbol}`
                : data.market.price_symbol
                ? `Price symbol: ${data.market.price_symbol}`
                : "Stored DB pricing"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((r) => (
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

            <div className="ml-2 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Rows
              </span>
              {RECENT_ROW_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRecentRows(n)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors",
                    recentRowsParam === n
                      ? "bg-white/12 text-white ring-white/20"
                      : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>

            {analysisInput ? <AnalyzeCotButton input={analysisInput} /> : null}
          </div>
        </div>
      </div>

      {latest && derivedStats ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Positioning"
              value={<Badge tone={toneFromBias(latest.bias)}>{latest.bias ?? "—"}</Badge>}
              subvalue={latest.positioning ?? latestShift}
            />

            <StatCard
              label="Weekly shift"
              value={
                <Badge tone={toneFromPositioningShift(latest.bias, latest.d_large)}>
                  {latestShift}
                </Badge>
              }
              subvalue={<DeltaLine value={latest.d_large} formatter={fmtSignedNum} />}
            />

            <StatCard
              label="Net contracts"
              value={fmtNum(derivedStats.latestNet)}
              subvalue={`Net % OI: ${fmtPctUnsigned(derivedStats.netPctOi)}`}
              valueClass={deltaToneClass(derivedStats.latestNet)}
            />

            <StatCard
              label="Gross contracts"
              value={fmtNum(derivedStats.grossContracts)}
              subvalue={`Net % Gross: ${fmtPctUnsigned(derivedStats.netPctGross)}`}
              help={grossPositionHelpText()}
            />

            <StatCard
              label="Long contracts"
              value={fmtNum(derivedStats.latestLong)}
              subvalue={<DeltaLine value={latest.d_large_long} formatter={fmtSignedNum} />}
            />

            <StatCard
              label="Short contracts"
              value={fmtNum(derivedStats.latestShort)}
              subvalue={<DeltaLine value={latest.d_large_short} formatter={fmtSignedNum} />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Report price"
              value={fmtPx(latestDisplayReportPrice)}
              subvalue={`Release: ${fmtPx(latestDisplayReleasePrice)}`}
              help={reportPriceHelpText(isFx)}
            />

            <StatCard
              label="Large specs USD"
              value={fmtUsd(latest.large_spec_net_usd)}
              subvalue={<DeltaLine value={latest.d_large_usd} formatter={fmtUsd} />}
            />

            <StatCard
              label="Open interest"
              value={fmtNum(derivedStats.latestOi)}
              subvalue={`vs 52w avg: ${fmtPct(derivedStats.oiVsAvg)}`}
            />

            <StatCard
              label="52w net range"
              value={`${fmtNum(derivedStats.net52wLow)} → ${fmtNum(derivedStats.net52wHigh)}`}
              subvalue={`Current: ${fmtPctUnsigned(derivedStats.netRangePct)}`}
              help={rangeHelpText("52w net range")}
            />

            <StatCard
              label="52w USD range"
              value={`${fmtUsd(derivedStats.usd52wLow)} → ${fmtUsd(derivedStats.usd52wHigh)}`}
              subvalue={`Current: ${fmtPctUnsigned(derivedStats.usdRangePct)}`}
              help={rangeHelpText("52w USD range")}
            />

            <StatCard
              label="Price response"
              value={
                <div className="flex items-center gap-2">
                  <Badge tone={toneFromReaction(latest.reaction_type)}>
                    {latest.reaction_type ?? "—"}
                  </Badge>
                  <span className="text-sm text-slate-300">
                    {fmtPct(latest.move_pct_report_to_release)}
                  </span>
                </div>
              }
              help={reactionHelpText(isFx)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <StatCard
              label="Small traders USD"
              value={fmtUsd(latest.small_traders_net_usd)}
              subvalue={<DeltaLine value={latest.d_small_usd} formatter={fmtUsd} />}
            />

            <StatCard
              label="Commercials USD"
              value={fmtUsd(latest.commercials_net_usd)}
              subvalue={<DeltaLine value={latest.d_comm_usd} formatter={fmtUsd} />}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Current read
            </div>
            <div className="mt-2 text-sm text-slate-200">
              {narrative ?? "No current positioning summary available."}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>Report: {fmtPx(latestDisplayReportPrice)}</span>
              <span>Release: {fmtPx(latestDisplayReleasePrice)}</span>
              <span>Direction: {latest.price_direction ?? "—"}</span>
              <span>Gross: {fmtNum(derivedStats.grossContracts)}</span>
              <span>Net % Gross: {fmtPctUnsigned(derivedStats.netPctGross)}</span>
              <span>Net % OI: {fmtPctUnsigned(derivedStats.netPctOi)}</span>
            </div>
          </div>
        </>
      ) : null}

      <CotCharts series={series} />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
        <div className="border-b border-white/10 px-4 py-3 text-sm text-slate-300">
          Recent positioning + pricing
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium min-w-[220px]">
                  Positioning
                </th>
                <th className="px-4 py-3 text-left font-medium">Open Interest</th>
                <th className="px-4 py-3 text-left font-medium">Small Traders Net</th>
                <th className="px-4 py-3 text-left font-medium">Commercials Net</th>
                <th className="px-4 py-3 text-left font-medium">Large Specs Net</th>
                <th className="px-4 py-3 text-left font-medium">Large Specs Long</th>
                <th className="px-4 py-3 text-left font-medium">Large Specs Short</th>
                <th className="px-4 py-3 text-left font-medium">
                  <div className="flex items-center gap-2">
                    <span>Report Price</span>
                    <TooltipInfo text={reportPriceHelpText(isFx)} />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span>Price Move</span>
                    <TooltipInfo text={reactionHelpText(isFx)} />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium">USD Notional</th>
              </tr>
            </thead>

            <tbody>
              {data.recent.map((r) => {
                const hasReaction =
                  r.move_pct_report_to_release != null ||
                  r.report_price != null ||
                  r.release_price != null ||
                  r.reaction_type != null;

                const displayReportPrice = getDisplayReportPrice(r, isFx);
                const displayReleasePrice = getDisplayReleasePrice(r, isFx);

                return (
                  <tr
                    key={r.date}
                    className="border-t border-white/5 align-top hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5 text-slate-200">{r.date}</td>

                    <td className="px-4 py-2.5">
                      <PositioningCell row={r} />
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.open_interest}
                        delta={r.d_oi}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.small_traders_net}
                        delta={r.d_small}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.commercials_net}
                        delta={r.d_comm}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.large_spec_net}
                        delta={r.d_large}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.large_spec_long}
                        delta={r.d_large_long}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.large_spec_short}
                        delta={r.d_large_short}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <CellStack
                        top={fmtPx(displayReportPrice)}
                        bottom={
                          <span className="text-xs text-slate-400">
                            Release: {fmtPx(displayReleasePrice)}
                          </span>
                        }
                        topClass="text-slate-100"
                        bottomClass="text-xs"
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      {hasReaction ? (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums text-slate-100">
                              {fmtPct(r.move_pct_report_to_release)}
                            </span>
                            <Badge tone={toneFromReaction(r.reaction_type)}>
                              {r.reaction_type
                                ? r.reaction_type.charAt(0).toUpperCase() + r.reaction_type.slice(1)
                                : "—"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {fmtPx(displayReportPrice)} → {fmtPx(displayReleasePrice)}
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="tabular-nums text-slate-100">—</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            No release reaction yet
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <InlineValueWithDelta
                        value={r.large_spec_net_usd}
                        delta={r.d_large_usd}
                        valueFormatter={fmtUsd}
                        deltaFormatter={fmtUsd}
                      />
                    </td>
                  </tr>
                );
              })}

              {data.recent.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-slate-400">
                    No recent rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}