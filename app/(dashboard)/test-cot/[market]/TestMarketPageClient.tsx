"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import CotCharts from "@/app/(dashboard)/cot/components/CotCharts";
import AnalyzeCotButton from "./AnalyzeCotButton";

type RecentRow = {
  date: string;
  release_date?: string | null;
  next_report_date?: string | null;

  open_interest: number | null;
  large_spec_net: number;
  large_spec_long?: number | null;
  large_spec_short?: number | null;
  large_spec_gross_contracts?: number | null;

  small_traders_net: number;
  small_traders_long?: number | null;
  small_traders_short?: number | null;
  small_traders_gross_contracts?: number | null;

  commercials_net: number;
  commercials_long?: number | null;
  commercials_short?: number | null;
  commercials_gross_contracts?: number | null;

  report_price?: number | null;
  release_price?: number | null;
  next_report_price?: number | null;

  indexed_report_price?: number | null;
  indexed_release_price?: number | null;

  bias?: string | null;
  positioning?: string | null;

  move_pct_report_to_release?: number | null;
  move_pct_release_to_next_report?: number | null;
  move_pct_report_to_next_report?: number | null;

  price_direction?: string | null;
  reaction_type?: string | null;

  large_spec_net_usd?: number | null;
  small_traders_net_usd?: number | null;
  commercials_net_usd?: number | null;

  large_spec_gross_usd?: number | null;
  small_traders_gross_usd?: number | null;
  commercials_gross_usd?: number | null;

  usd_per_contract?: number | null;

  d_large?: number;
  d_large_long?: number;
  d_large_short?: number;
  d_small?: number;
  d_comm?: number;
  d_oi?: number;
  d_large_usd?: number;
  d_small_usd?: number;
  d_comm_usd?: number;

  d_small_gross_contracts?: number | null;
  d_comm_gross_contracts?: number | null;

  small_gross_contracts_roc_pct?: number | null;
  comm_gross_contracts_roc_pct?: number | null;

  d_small_gross_usd?: number | null;
  d_comm_gross_usd?: number | null;

  small_gross_usd_roc_pct?: number | null;
  comm_gross_usd_roc_pct?: number | null;

  prev_usd_per_contract?: number | null;
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

function fmtIndex(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(2);
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

function fmtUsdFromMillions(v: number | null | undefined) {
  if (v == null) return "—";
  return fmtUsd(v * 1_000_000);
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

function reactionHelpText(isFx: boolean, isSyntheticUsd: boolean) {
  if (isSyntheticUsd) {
    return "For synthetic USD, Report → Release uses the stored USD basket index. Confirmation means the basket price moved in the same direction as the USD positioning shift into release. Fade means it moved against it.";
  }

  if (isFx) {
    return "For FX markets, Report → Release uses the indexed underlying currency view. Confirmation means the indexed currency moved in the same direction as the positioning shift into release. Fade means it moved against it.";
  }

  return "Confirmation means price moved in the same direction as the positioning shift into release. Fade means price moved against it.";
}

function reportPriceHelpText(isFx: boolean, isSyntheticUsd: boolean) {
  if (isSyntheticUsd) {
    return "For synthetic USD, displayed prices are the stored USD basket index values for report and release dates.";
  }

  if (isFx) {
    return "For FX markets, displayed prices are shown as a rebased indexed view for readability. USD notional is calculated separately from real pair pricing.";
  }

  return "For non-FX markets, this is the stored market price used for reaction analysis.";
}

function grossPositionHelpText(isSyntheticUsd: boolean) {
  if (isSyntheticUsd) {
    return "For synthetic USD, gross basket exposure is the sum of USD-bull and USD-bear basket legs, shown in USD terms rather than native futures contracts.";
  }
  return "Gross positioning is large spec longs plus large spec shorts. It shows depth of participation even when net positioning looks small.";
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

function rebaseFxDisplay(
  value: number | null | undefined,
  base: number | null | undefined
) {
  if (value == null || base == null || base === 0) return null;
  return (value / base) * 100;
}

function expectedDirectionFromShift(
  positioning: string | null | undefined,
  bias: string | null | undefined
): "up" | "down" | null {
  const p = (positioning ?? "").toLowerCase();
  const b = (bias ?? "").toLowerCase();

  if (p.includes("increasing bullish")) return "up";
  if (p.includes("less bullish")) return "down";
  if (p.includes("increasing bearish")) return "down";
  if (p.includes("less bearish")) return "up";
  if (p.includes("flat bullish")) return "up";
  if (p.includes("flat bearish")) return "down";

  if (b === "bullish") return "up";
  if (b === "bearish") return "down";
  return null;
}

function deriveShiftAwareReaction(row: RecentRow): "confirmation" | "fade" | null {
  const expected = expectedDirectionFromShift(row.positioning, row.bias);
  const actual = row.price_direction;

  if (!expected || !actual || actual === "flat") return null;
  return expected === actual ? "confirmation" : "fade";
}

function reactionDisplayLabel(row: RecentRow) {
  const derived = deriveShiftAwareReaction(row);
  if (!derived) return "—";
  return derived === "confirmation" ? "Confirmation" : "Fade";
}

function buildRead(latest: RecentRow | null, code: string, isSyntheticUsd: boolean) {
  if (!latest || !latest.bias) return null;

  const shift = latest.positioning ?? positioningShiftLabel(latest.bias, latest.d_large);
  const shiftReaction = deriveShiftAwareReaction(latest);
  const move = latest.move_pct_report_to_release;
  const moveTxt = move == null ? "—" : `${move > 0 ? "+" : ""}${move.toFixed(2)}%`;

  if (isSyntheticUsd) {
    if (shiftReaction === "confirmation") {
      return `USD basket positioning remains ${latest.bias} (${shift}) and the indexed USD basket confirmed the positioning shift into release (${moveTxt}).`;
    }

    if (shiftReaction === "fade") {
      return `USD basket positioning remains ${latest.bias} (${shift}) but the indexed USD basket faded the positioning shift into release (${moveTxt}).`;
    }

    return `USD basket positioning remains ${latest.bias} (${shift}). Report → Release move: ${moveTxt}.`;
  }

  if (shiftReaction === "confirmation") {
    return `${code} positioning remains ${latest.bias} (${shift}) and price confirmed the positioning shift into release (${moveTxt}).`;
  }

  if (shiftReaction === "fade") {
    return `${code} positioning remains ${latest.bias} (${shift}) but price faded the positioning shift into release (${moveTxt}).`;
  }

  return `${code} positioning remains ${latest.bias} (${shift}). Report → Release move: ${moveTxt}.`;
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

function PositioningCell({ row }: { row: RecentRow }) {
  const shiftLabel =
    row.positioning ?? positioningShiftLabel(row.bias, row.d_large);
  const shiftTone = toneFromPositioningShift(row.bias, row.d_large);

  return (
    <div className="flex max-w-[120px] flex-wrap gap-1.5 leading-tight">
      <Badge tone={toneFromBias(row.bias)}>
        {row.bias
          ? row.bias.charAt(0).toUpperCase() + row.bias.slice(1)
          : "—"}
      </Badge>

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

function DepthUsdCard({
  label,
  netUsd,
  deltaUsd,
  grossUsd,
  grossUsdDelta,
  grossUsdRoc,
  grossContracts,
  grossContractsDelta,
  grossContractsRoc,
}: {
  label: string;
  netUsd: number | null | undefined;
  deltaUsd: number | null | undefined;
  grossUsd: number | null | undefined;
  grossUsdDelta: number | null | undefined;
  grossUsdRoc: number | null | undefined;
  grossContracts: number | null | undefined;
  grossContractsDelta: number | null | undefined;
  grossContractsRoc: number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <TooltipInfo text="Top line shows net USD positioning. Second line shows weekly change in net USD. Bottom rows show gross USD depth and gross contracts, each with weekly change and ROC." />
      </div>

      <div className="mt-2 text-lg font-semibold text-slate-100">
        {fmtUsd(netUsd)}
      </div>

      <div className="mt-1 text-xs">
        <DeltaLine value={deltaUsd} formatter={fmtUsd} />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span>
          Gross USD: <span className="tabular-nums text-slate-200">{fmtUsd(grossUsd)}</span>
        </span>
        <span className={deltaToneClass(grossUsdDelta)}>
          {grossUsdDelta == null ? "—" : `${deltaIcon(grossUsdDelta)} ${fmtUsd(Math.abs(grossUsdDelta))}`}
        </span>
        <span>
          ROC: <span className="tabular-nums text-slate-200">{fmtPct(grossUsdRoc)}</span>
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span>
          Gross ctr: <span className="tabular-nums text-slate-200">{fmtNum(grossContracts)}</span>
        </span>
        <span className={deltaToneClass(grossContractsDelta)}>
          {grossContractsDelta == null ? "—" : `${deltaIcon(grossContractsDelta)} ${fmtNum(Math.abs(grossContractsDelta))}`}
        </span>
        <span>
          ROC: <span className="tabular-nums text-slate-200">{fmtPct(grossContractsRoc)}</span>
        </span>
      </div>
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

  const latest = data?.recent?.[0] ?? null;
  const isFx = Boolean(data?.market.isFx);
  const isSyntheticUsd = data?.market.key === "usd";

  const fxDisplayBase = useMemo(() => {
    if (!isFx || !data?.recent?.length || isSyntheticUsd) return null;
    const oldestVisible = data.recent[data.recent.length - 1];
    return getDisplayReportPrice(oldestVisible, true);
  }, [data, isFx, isSyntheticUsd]);

  const latestDisplayReportPrice = latest ? getDisplayReportPrice(latest, isFx) : null;
  const latestDisplayReleasePrice = latest ? getDisplayReleasePrice(latest, isFx) : null;

  const latestDisplayReportPriceRebased =
    isFx && !isSyntheticUsd && latestDisplayReportPrice != null
      ? rebaseFxDisplay(latestDisplayReportPrice, fxDisplayBase)
      : latestDisplayReportPrice;

  const latestDisplayReleasePriceRebased =
    isFx && !isSyntheticUsd && latestDisplayReleasePrice != null
      ? rebaseFxDisplay(latestDisplayReleasePrice, fxDisplayBase)
      : latestDisplayReleasePrice;

  const analysisInput = useMemo(() => {
    if (!data || !data.recent?.length || !latest) return null;

    const latestLong = latest.large_spec_long ?? null;
    const latestShort = latest.large_spec_short ?? null;

    const grossContracts =
      latestLong != null && latestShort != null ? latestLong + latestShort : null;

    const netPctOi =
      !isSyntheticUsd &&
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

    const netSeries = data.large.filter((v) => Number.isFinite(v));
    const usdSeries = (data.large_usd ?? []).filter(
      (v): v is number => v != null && Number.isFinite(v)
    );
    const oiSeries = data.open_interest.filter(
      (v): v is number => v != null && Number.isFinite(v)
    );

    const net52wHigh = isSyntheticUsd
      ? (usdSeries.length ? Math.max(...usdSeries) : null)
      : (netSeries.length ? Math.max(...netSeries) : null);

    const net52wLow = isSyntheticUsd
      ? (usdSeries.length ? Math.min(...usdSeries) : null)
      : (netSeries.length ? Math.min(...netSeries) : null);

    const usd52wHigh = usdSeries.length ? Math.max(...usdSeries) : null;
    const usd52wLow = usdSeries.length ? Math.min(...usdSeries) : null;
    const oi52wAvg = oiSeries.length
      ? oiSeries.reduce((sum, v) => sum + v, 0) / oiSeries.length
      : null;

    const oiVsAvgPct =
      latest.open_interest != null && oi52wAvg != null && oi52wAvg !== 0
        ? ((latest.open_interest - oi52wAvg) / oi52wAvg) * 100
        : null;

    const latestRangeValue = isSyntheticUsd
      ? latest.large_spec_net_usd ?? null
      : latest.large_spec_net ?? null;

    const netRangePct =
      latestRangeValue != null &&
      net52wHigh != null &&
      net52wLow != null &&
      net52wHigh !== net52wLow
        ? ((latestRangeValue - net52wLow) / (net52wHigh - net52wLow)) * 100
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
      reactionType: deriveShiftAwareReaction(latest),

      net52wHigh,
      net52wLow,
      netRangePct,

      usd52wHigh,
      usd52wLow,
      usdRangePct,

      oi52wAvg,
      oiVsAvgPct,

      notes:
        "Derived from DB-backed COT market page with speculative positioning depth, 52-week context, USD notionals, and report-to-release reaction.",
    };
  }, [data, latest, latestDisplayReportPrice, latestDisplayReleasePrice, range, isFx, isSyntheticUsd]);

  const narrative = buildRead(latest, data?.market.code ?? "", isSyntheticUsd);
  const latestShift = latest
    ? latest.positioning ?? positioningShiftLabel(latest.bias, latest.d_large)
    : "Neutral";

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
      !isSyntheticUsd && latestOi && latestNet != null
        ? (latestNet / latestOi) * 100
        : null;

    const netSeries = data.large.filter((v) => Number.isFinite(v));
    const usdSeries = (data.large_usd ?? []).filter(
      (v): v is number => v != null && Number.isFinite(v)
    );
    const oiSeries = data.open_interest.filter(
      (v): v is number => v != null && Number.isFinite(v)
    );

    const net52wHigh = isSyntheticUsd
      ? (usdSeries.length ? Math.max(...usdSeries) : null)
      : (netSeries.length ? Math.max(...netSeries) : null);

    const net52wLow = isSyntheticUsd
      ? (usdSeries.length ? Math.min(...usdSeries) : null)
      : (netSeries.length ? Math.min(...netSeries) : null);

    const usd52wHigh = usdSeries.length ? Math.max(...usdSeries) : null;
    const usd52wLow = usdSeries.length ? Math.min(...usdSeries) : null;
    const oi52wAvg = oiSeries.length
      ? oiSeries.reduce((sum, v) => sum + v, 0) / oiSeries.length
      : null;

    const oiVsAvg =
      latestOi != null && oi52wAvg != null && oi52wAvg !== 0
        ? ((latestOi - oi52wAvg) / oi52wAvg) * 100
        : null;

    const rangeValue = isSyntheticUsd ? latestUsd : latestNet;

    const netRangePct =
      rangeValue != null &&
      net52wHigh != null &&
      net52wLow != null &&
      net52wHigh !== net52wLow
        ? ((rangeValue - net52wLow) / (net52wHigh - net52wLow)) * 100
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
  }, [data, latest, isSyntheticUsd]);

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

  const latestReaction = latest ? deriveShiftAwareReaction(latest) : null;

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
              {isSyntheticUsd
                ? "Synthetic basket built from EUR, JPY, GBP, AUD, NZD, CAD, and CHF COT legs"
                : isFx && data.market.fx_symbol
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
              subvalue={
                <DeltaLine
                  value={isSyntheticUsd ? latest.d_large_usd : latest.d_large}
                  formatter={isSyntheticUsd ? fmtUsd : fmtSignedNum}
                />
              }
            />

            <StatCard
              label={isSyntheticUsd ? "Net basket USD" : "Net contracts"}
              value={isSyntheticUsd ? fmtUsd(latest.large_spec_net_usd) : fmtNum(derivedStats.latestNet)}
              subvalue={
                isSyntheticUsd
                  ? `Net % Gross: ${fmtPctUnsigned(derivedStats.netPctGross)}`
                  : `Net % OI: ${fmtPctUnsigned(derivedStats.netPctOi)}`
              }
              valueClass={deltaToneClass(isSyntheticUsd ? latest.large_spec_net_usd : derivedStats.latestNet)}
            />

            <StatCard
              label={isSyntheticUsd ? "Gross basket USD" : "Gross contracts"}
              value={
                isSyntheticUsd
                  ? fmtUsdFromMillions(derivedStats.grossContracts)
                  : fmtNum(derivedStats.grossContracts)
              }
              subvalue={`Net % Gross: ${fmtPctUnsigned(derivedStats.netPctGross)}`}
              help={grossPositionHelpText(isSyntheticUsd)}
            />

            <StatCard
              label={isSyntheticUsd ? "USD-bull basket" : "Long contracts"}
              value={
                isSyntheticUsd
                  ? fmtUsdFromMillions(derivedStats.latestLong)
                  : fmtNum(derivedStats.latestLong)
              }
              subvalue={
                <DeltaLine
                  value={isSyntheticUsd ? latest.d_large_long : latest.d_large_long}
                  formatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                />
              }
            />

            <StatCard
              label={isSyntheticUsd ? "USD-bear basket" : "Short contracts"}
              value={
                isSyntheticUsd
                  ? fmtUsdFromMillions(derivedStats.latestShort)
                  : fmtNum(derivedStats.latestShort)
              }
              subvalue={
                <DeltaLine
                  value={isSyntheticUsd ? latest.d_large_short : latest.d_large_short}
                  formatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                />
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label={isSyntheticUsd ? "Indexed USD price" : isFx ? "Indexed price" : "Report price"}
              value={
                isFx
                  ? fmtIndex(latestDisplayReportPriceRebased)
                  : fmtPx(latestDisplayReportPrice)
              }
              subvalue={
                isFx
                  ? `Release: ${fmtIndex(latestDisplayReleasePriceRebased)}`
                  : `Release: ${fmtPx(latestDisplayReleasePrice)}`
              }
              help={reportPriceHelpText(isFx, isSyntheticUsd)}
            />

            <StatCard
              label={isSyntheticUsd ? "Weekly USD delta" : "Large specs USD"}
              value={
                isSyntheticUsd
                  ? fmtUsd(latest.d_large_usd)
                  : fmtUsd(latest.large_spec_net_usd)
              }
              subvalue={
                isSyntheticUsd
                  ? `Net USD: ${fmtUsd(latest.large_spec_net_usd)}`
                  : <DeltaLine value={latest.d_large_usd} formatter={fmtUsd} />
              }
            />

            <StatCard
              label={isSyntheticUsd ? "Aggregate FX OI" : "Open interest"}
              value={fmtNum(derivedStats.latestOi)}
              subvalue={`vs 52w avg: ${fmtPct(derivedStats.oiVsAvg)}`}
            />

            <StatCard
              label={isSyntheticUsd ? "52w net USD range" : "52w net range"}
              value={
                isSyntheticUsd
                  ? `${fmtUsd(derivedStats.net52wLow)} → ${fmtUsd(derivedStats.net52wHigh)}`
                  : `${fmtNum(derivedStats.net52wLow)} → ${fmtNum(derivedStats.net52wHigh)}`
              }
              subvalue={`Current: ${fmtPctUnsigned(derivedStats.netRangePct)}`}
              help={rangeHelpText(isSyntheticUsd ? "52w net USD range" : "52w net range")}
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
                  <Badge tone={toneFromReaction(latestReaction)}>
                    {latest ? reactionDisplayLabel(latest) : "—"}
                  </Badge>
                  <span className="text-sm text-slate-300">
                    {fmtPct(latest?.move_pct_report_to_release)}
                  </span>
                </div>
              }
              help={reactionHelpText(isFx, isSyntheticUsd)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DepthUsdCard
              label="Small traders USD"
              netUsd={latest.small_traders_net_usd}
              deltaUsd={latest.d_small_usd}
              grossUsd={latest.small_traders_gross_usd}
              grossUsdDelta={latest.d_small_gross_usd}
              grossUsdRoc={latest.small_gross_usd_roc_pct}
              grossContracts={latest.small_traders_gross_contracts}
              grossContractsDelta={latest.d_small_gross_contracts}
              grossContractsRoc={latest.small_gross_contracts_roc_pct}
            />

            <DepthUsdCard
              label="Commercials USD"
              netUsd={latest.commercials_net_usd}
              deltaUsd={latest.d_comm_usd}
              grossUsd={latest.commercials_gross_usd}
              grossUsdDelta={latest.d_comm_gross_usd}
              grossUsdRoc={latest.comm_gross_usd_roc_pct}
              grossContracts={latest.commercials_gross_contracts}
              grossContractsDelta={latest.d_comm_gross_contracts}
              grossContractsRoc={latest.comm_gross_contracts_roc_pct}
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
              <span>
                Report:{" "}
                {isFx
                  ? fmtIndex(latestDisplayReportPriceRebased)
                  : fmtPx(latestDisplayReportPrice)}
              </span>
              <span>
                Release:{" "}
                {isFx
                  ? fmtIndex(latestDisplayReleasePriceRebased)
                  : fmtPx(latestDisplayReleasePrice)}
              </span>
              <span>Direction: {latest.price_direction ?? "—"}</span>
              <span>
                {isSyntheticUsd
                  ? `Gross basket USD: ${fmtUsdFromMillions(derivedStats.grossContracts)}`
                  : `Gross: ${fmtNum(derivedStats.grossContracts)}`}
              </span>
              <span>Net % Gross: {fmtPctUnsigned(derivedStats.netPctGross)}</span>
              {!isSyntheticUsd ? (
                <span>Net % OI: {fmtPctUnsigned(derivedStats.netPctOi)}</span>
              ) : null}
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
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium min-w-[110px]">
                  Positioning
                </th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                  {isSyntheticUsd ? "Agg FX OI" : "OI"}
                </th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Small</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Comm</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                  {isSyntheticUsd ? "Basket Net" : "Large"}
                </th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                  {isSyntheticUsd ? "USD Bull" : "Long"}
                </th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                  {isSyntheticUsd ? "USD Bear" : "Short"}
                </th>
                <th className="px-4 py-3 text-left font-medium min-w-[220px]">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>Price Path</span>
                    <TooltipInfo text={reportPriceHelpText(isFx, isSyntheticUsd)} />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium min-w-[220px]">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>Price Move</span>
                    <TooltipInfo text={reactionHelpText(isFx, isSyntheticUsd)} align="right" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">USD</th>
              </tr>
            </thead>

            <tbody>
              {data.recent.map((r) => {
                const rawReport = getDisplayReportPrice(r, isFx);
                const rawRelease = getDisplayReleasePrice(r, isFx);

                const displayReport =
                  isFx && !isSyntheticUsd
                    ? rebaseFxDisplay(rawReport, fxDisplayBase)
                    : rawReport;

                const displayRelease =
                  isFx && !isSyntheticUsd
                    ? rebaseFxDisplay(rawRelease, fxDisplayBase)
                    : rawRelease;

                const shiftReaction = deriveShiftAwareReaction(r);

                return (
                  <tr
                    key={r.date}
                    className="border-t border-white/5 align-top hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-slate-200 whitespace-nowrap">{r.date}</td>

                    <td className="px-4 py-3 align-top">
                      <PositioningCell row={r} />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <InlineValueWithDelta
                        value={r.open_interest}
                        delta={r.d_oi}
                        valueFormatter={fmtNum}
                        deltaFormatter={fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <InlineValueWithDelta
                        value={r.small_traders_net}
                        delta={r.d_small}
                        valueFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtNum}
                        deltaFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <InlineValueWithDelta
                        value={r.commercials_net}
                        delta={r.d_comm}
                        valueFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtNum}
                        deltaFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <InlineValueWithDelta
                        value={r.large_spec_net}
                        delta={r.d_large}
                        valueFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtNum}
                        deltaFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <InlineValueWithDelta
                        value={r.large_spec_long}
                        delta={r.d_large_long}
                        valueFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtNum}
                        deltaFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <InlineValueWithDelta
                        value={r.large_spec_short}
                        delta={r.d_large_short}
                        valueFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtNum}
                        deltaFormatter={isSyntheticUsd ? fmtUsdFromMillions : fmtSignedNum}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1 whitespace-nowrap">
                        <div className="text-xs text-slate-500">Report → Release</div>
                        <div className="tabular-nums text-slate-100">
                          {isFx ? fmtIndex(displayReport) : fmtPx(displayReport)} →{" "}
                          {isFx ? fmtIndex(displayRelease) : fmtPx(displayRelease)}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Badge tone={toneFromReaction(shiftReaction)}>
                            {reactionDisplayLabel(r)}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-400 whitespace-nowrap">
                          Report → Release:{" "}
                          <span className="tabular-nums text-slate-200">
                            {fmtPct(r.move_pct_report_to_release)}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
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