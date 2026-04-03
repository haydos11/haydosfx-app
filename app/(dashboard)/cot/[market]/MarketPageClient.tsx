"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { CotSeries } from "@/lib/cot/shape";
import RangeControls from "../components/RangeControls";

const CotCharts = dynamic(() => import("../components/CotCharts"), { ssr: false });

type RecentRow = {
  date: string;
  open_interest: number | null;

  large_spec_net: number;
  large_spec_long: number | null;
  large_spec_short: number | null;

  small_traders_net: number;
  commercials_net: number;

  report_price?: number | null;
  release_price?: number | null;

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
  d_large_usd?: number | null;
  d_small_usd?: number | null;
  d_comm_usd?: number | null;
};

type UsdPoint = { date: string; netNotionalUSD: number | null };

type MarketMeta = {
  key: string;
  code: string;
  name: string;
  dbCode: string;
  isFx?: boolean;
  fx_symbol?: string | null;
  price_symbol?: string | null;
};

type WithUsdPoints = Omit<CotSeries, "recent" | "market"> & {
  market: MarketMeta;
  recent: RecentRow[];
  points?: UsdPoint[];
  range?: { from?: string; to?: string; label?: string };
  updated: string;
};

function fmtUSD(x: number): string {
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtNum(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toLocaleString();
}

function fmtPrice(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1000) return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(x) >= 100) return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(x) >= 1) return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return x.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function fmtPct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${x > 0 ? "+" : ""}${x.toFixed(2)}%`;
}

function Delta({
  curr,
  prev,
  fmt = (n: number) => n.toLocaleString(),
}: {
  curr?: number | null;
  prev?: number | null;
  fmt?: (n: number) => string;
}) {
  if (curr == null || prev == null || !Number.isFinite(curr) || !Number.isFinite(prev)) {
    return <span className="ml-1 text-xs text-slate-500">—</span>;
  }
  const d = curr - prev;
  if (d === 0) return <span className="ml-1 text-xs text-slate-500">0</span>;
  const up = d > 0;
  return (
    <span
      className={[
        "ml-1 inline-flex items-center gap-0.5 text-xs",
        up ? "text-emerald-400" : "text-rose-400",
      ].join(" ")}
      title={`Δ ${fmt(d)}`}
    >
      {up ? "▲" : "▼"} {fmt(Math.abs(d))}
    </span>
  );
}

type HeatMode = "off" | "z" | "abs";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mad(arr: number[], med: number) {
  if (!arr.length) return 0;
  const dev = arr.map((v) => Math.abs(v - med)).sort((x, y) => x - y);
  const m = Math.floor(dev.length / 2);
  const raw = dev.length % 2 ? dev[m] : (dev[m - 1] + dev[m]) / 2;
  return raw * 1.4826;
}

function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const i = (a.length - 1) * clamp01(p);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return a[lo];
  const t = i - lo;
  return a[lo] * (1 - t) + a[hi] * t;
}

const ZCAP = 3.0;
const Z_ALPHA_MAX = 0.6;
const ABS_P = 0.8;

function robustZHeat(value: number | null | undefined, med: number, s: number): string | null {
  if (value == null || !Number.isFinite(value) || !Number.isFinite(s) || s === 0) return null;
  const z = (value - med) / s;
  const t = clamp01(Math.abs(z) / ZCAP);
  const alpha = 0.07 + Z_ALPHA_MAX * Math.pow(t, 0.85);
  if (alpha <= 0.08) return null;
  const hue = z >= 0 ? 156 : 350;
  return `hsla(${hue},72%,42%,${alpha})`;
}

function absoluteHeat(value: number | null | undefined, pAbs: number): string | null {
  if (value == null || !Number.isFinite(value) || pAbs <= 0) return null;
  const t = clamp01(Math.abs(value) / pAbs);
  const alpha = 0.06 + 0.46 * Math.pow(t, 0.9);
  const hue = value >= 0 ? 156 : 350;
  return `hsla(${hue},72%,42%,${alpha})`;
}

function usdLogHeat(value: number | null | undefined, minLog: number, maxLog: number): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs <= 0 || !Number.isFinite(minLog) || !Number.isFinite(maxLog) || maxLog <= minLog) {
    return null;
  }
  const t = clamp01((Math.log10(abs) - minLog) / (maxLog - minLog));
  const alpha = 0.06 + 0.4 * Math.pow(t, 0.95);
  const hue = value >= 0 ? 156 : 350;
  return `hsla(${hue},72%,42%,${alpha})`;
}

function badgeClass(kind: "bull" | "bear" | "neutral" | "confirmation" | "fade" | "flat") {
  switch (kind) {
    case "bull":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25";
    case "bear":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/25";
    case "neutral":
      return "bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/25";
    case "confirmation":
      return "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/25";
    case "fade":
      return "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/25";
    default:
      return "bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/25";
  }
}

function pill(text: string, kind: Parameters<typeof badgeClass>[0]) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass(kind)}`}>
      {text}
    </span>
  );
}

export default function MarketPageClient({
  market,
  range,
}: {
  market: string;
  range: string;
}) {
  const [data, setData] = useState<WithUsdPoints | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tableSpan, setTableSpan] = useState<"3m" | "1y" | "3y" | "5y">("3m");
  const [heatMode, setHeatMode] = useState<HeatMode>("off");

  function cutoffFromSpan(span: "3m" | "1y" | "3y" | "5y"): string {
    const d = new Date();
    if (span === "3m") d.setMonth(d.getMonth() - 3);
    if (span === "1y") d.setFullYear(d.getFullYear() - 1);
    if (span === "3y") d.setFullYear(d.getFullYear() - 3);
    if (span === "5y") d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().slice(0, 10);
  }

  function spanToApiRange(span: "3m" | "1y" | "3y" | "5y"): "1y" | "3y" | "5y" {
    if (span === "3m" || span === "1y") return "1y";
    if (span === "3y") return "3y";
    return "5y";
  }

  function maxRangeLabel(a: string, b: "1y" | "3y" | "5y"): "1y" | "3y" | "5y" {
    const order = ["1y", "3y", "5y"] as const;
    const aNorm: "1y" | "3y" | "5y" = a === "3y" || a === "5y" ? (a as "3y" | "5y") : "1y";
    return order[Math.max(order.indexOf(aNorm), order.indexOf(b))];
  }

  const apiRange = useMemo(() => {
    const needFromTable = spanToApiRange(tableSpan);
    return maxRangeLabel(range, needFromTable);
  }, [range, tableSpan]);

  useEffect(() => {
    if (!market) return;

    let cancelled = false;

    (async () => {
      try {
        setErr(null);

        const res = await fetch(
          `/api/cot/market/${encodeURIComponent(market)}?range=${encodeURIComponent(apiRange)}&basis=usd`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error((await res.text().catch(() => "")) || `API ${res.status}`);
        }

        const json: WithUsdPoints = await res.json();

        if (!cancelled) {
          setData(json);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setData(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [market, apiRange]);

  const usdByDate = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const p of data?.points ?? []) {
      map.set(p.date, p.netNotionalUSD ?? null);
    }
    return map;
  }, [data?.points]);

  const recentForTable = useMemo(() => {
    if (!data?.recent?.length) return [];
    const cutoff = cutoffFromSpan(tableSpan);
    return data.recent.filter((r) => (r.date ?? "") >= cutoff);
  }, [data, tableSpan]);

  const heatStats = useMemo(() => {
    const lsnVals: number[] = [];
    const comVals: number[] = [];
    const lsnAbs: number[] = [];
    const comAbs: number[] = [];
    const usdAbsLogs: number[] = [];

    for (const r of recentForTable) {
      const lsn = r.large_spec_net ?? null;
      const com = r.commercials_net ?? null;
      const usd = (r.large_spec_net_usd ?? usdByDate.get(r.date)) ?? null;

      if (lsn != null) {
        lsnVals.push(lsn);
        lsnAbs.push(Math.abs(lsn));
      }
      if (com != null) {
        comVals.push(com);
        comAbs.push(Math.abs(com));
      }
      if (usd != null && Math.abs(usd) > 0) {
        usdAbsLogs.push(Math.log10(Math.abs(usd)));
      }
    }

    const lsnMed = median(lsnVals);
    const lsnMAD = mad(lsnVals, lsnMed) || 1;
    const comMed = median(comVals);
    const comMAD = mad(comVals, comMed) || 1;

    const lsnP = percentile(lsnAbs, ABS_P) || 1;
    const comP = percentile(comAbs, ABS_P) || 1;

    const usdMinLog = usdAbsLogs.length ? Math.min(...usdAbsLogs) : 0;
    const usdMaxLog = usdAbsLogs.length ? Math.max(...usdAbsLogs) : 1;

    return { lsnMed, lsnMAD, comMed, comMAD, lsnP, comP, usdMinLog, usdMaxLog };
  }, [recentForTable, usdByDate]);

  function cellHeatStyleLSN(val: number | null | undefined): CSSProperties | undefined {
    if (heatMode === "off") return undefined;
    const color =
      heatMode === "z"
        ? robustZHeat(val ?? null, heatStats.lsnMed, heatStats.lsnMAD)
        : absoluteHeat(val ?? null, heatStats.lsnP);
    return color ? { boxShadow: `inset 0 0 0 9999px ${color}` } : undefined;
  }

  function cellHeatStyleCOM(val: number | null | undefined): CSSProperties | undefined {
    if (heatMode === "off") return undefined;
    const color =
      heatMode === "z"
        ? robustZHeat(val ?? null, heatStats.comMed, heatStats.comMAD)
        : absoluteHeat(val ?? null, heatStats.comP);
    return color ? { boxShadow: `inset 0 0 0 9999px ${color}` } : undefined;
  }

  function cellHeatStyleUSD(val: number | null | undefined): CSSProperties | undefined {
    if (heatMode === "off") return undefined;
    const color = usdLogHeat(val ?? null, heatStats.usdMinLog, heatStats.usdMaxLog);
    return color ? { boxShadow: `inset 0 0 0 9999px ${color}` } : undefined;
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="mb-4 text-sm">
        <Link
          href={`/cot?range=${encodeURIComponent(range)}`}
          className="text-slate-400 hover:text-slate-200"
        >
          ← Back to COT Report
        </Link>
      </div>

      {err && <div className="text-rose-400">{err}</div>}
      {!data && !err && <div className="text-slate-300">Loading…</div>}

      {data && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                {data.market.code} — {data.market.name}
              </h1>
              <div className="mt-1 text-xs text-slate-400">
                {data.market.price_symbol
                  ? `Price source: ${data.market.price_symbol}`
                  : data.market.dbCode}
                {data.market.isFx ? " • FX reaction model enabled" : " • Spot reaction derived from daily price map"}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">
                Updated {new Date(data.updated).toLocaleString()}
              </div>
              <RangeControls />
            </div>
          </div>

          <CotCharts series={data} height={260} compact />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-400">
                Recent values ({data.market.code})
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-full bg-white/5 p-0.5 ring-1 ring-inset ring-white/10">
                  {(["3m", "1y", "3y", "5y"] as const).map((span) => (
                    <button
                      key={span}
                      onClick={() => setTableSpan(span)}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs transition-colors",
                        tableSpan === span
                          ? "bg-violet-600 text-white"
                          : "text-slate-300 hover:bg-white/10",
                      ].join(" ")}
                      aria-pressed={tableSpan === span}
                    >
                      {span.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <span className="select-none text-xs text-slate-400">Heatmap:</span>
                  <div className="flex rounded-full bg-white/5 p-0.5 ring-1 ring-inset ring-white/10">
                    {(["off", "z", "abs"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setHeatMode(mode)}
                        className={[
                          "rounded-full px-2.5 py-1 text-xs transition-colors",
                          heatMode === mode
                            ? "bg-violet-600 text-white"
                            : "text-slate-300 hover:bg-white/10",
                        ].join(" ")}
                        aria-pressed={heatMode === mode}
                        title={
                          mode === "off"
                            ? "Turn heatmap off"
                            : mode === "z"
                            ? "Relative (Z-score vs median/MAD) per column"
                            : "Absolute (vs p80 of |values|) per column"
                        }
                      >
                        {mode === "off" ? "Off" : mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Bias</th>
                      <th className="px-4 py-3 text-left font-medium">Open Interest</th>
                      <th className="px-4 py-3 text-left font-medium">Small Net</th>
                      <th className="px-4 py-3 text-left font-medium">Commercials Net</th>
                      <th className="px-4 py-3 text-left font-medium">Large Specs Net</th>
                      <th className="px-4 py-3 text-left font-medium">Large Long</th>
                      <th className="px-4 py-3 text-left font-medium">Large Short</th>
                      <th className="px-4 py-3 text-left font-medium">USD Notional</th>
                      <th className="px-4 py-3 text-left font-medium">Report Price</th>
                      <th className="px-4 py-3 text-left font-medium">Release Price</th>
                      <th className="px-4 py-3 text-left font-medium">Move</th>
                      <th className="px-4 py-3 text-left font-medium">Reaction</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentForTable.map((r) => {
                      const usd = (r.large_spec_net_usd ?? usdByDate.get(r.date)) ?? null;

                      const biasNode =
                        r.bias === "bullish"
                          ? pill("Bullish", "bull")
                          : r.bias === "bearish"
                          ? pill("Bearish", "bear")
                          : r.bias === "neutral"
                          ? pill("Neutral", "neutral")
                          : <span className="text-slate-500">—</span>;

                      const reactionNode =
                        r.reaction_type === "confirmation"
                          ? pill("Confirmation", "confirmation")
                          : r.reaction_type === "fade"
                          ? pill("Fade", "fade")
                          : <span className="text-slate-500">—</span>;

                      const move = r.move_pct_report_to_release ?? null;
                      const moveClass =
                        move == null
                          ? "text-slate-500"
                          : move > 0
                          ? "text-emerald-400"
                          : move < 0
                          ? "text-rose-400"
                          : "text-slate-300";

                      return (
                        <tr
                          key={`${r.date}-${data.market.dbCode}`}
                          className="border-t border-white/5 hover:bg-white/[0.03]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-slate-200">
                            <div>{r.date}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {r.positioning ?? "—"}
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">{biasNode}</td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(r.open_interest)}
                            <Delta curr={r.open_interest ?? null} prev={r.open_interest != null && r.d_oi != null ? r.open_interest - r.d_oi : null} />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(r.small_traders_net)}
                            <Delta
                              curr={r.small_traders_net}
                              prev={r.d_small != null ? r.small_traders_net - r.d_small : null}
                            />
                          </td>

                          <td
                            className="px-4 py-3 tabular-nums text-slate-200"
                            style={cellHeatStyleCOM(r.commercials_net)}
                          >
                            {fmtNum(r.commercials_net)}
                            <Delta
                              curr={r.commercials_net}
                              prev={r.d_comm != null ? r.commercials_net - r.d_comm : null}
                            />
                          </td>

                          <td
                            className="px-4 py-3 tabular-nums text-slate-200"
                            style={cellHeatStyleLSN(r.large_spec_net)}
                          >
                            {fmtNum(r.large_spec_net)}
                            <Delta
                              curr={r.large_spec_net}
                              prev={r.d_large != null ? r.large_spec_net - r.d_large : null}
                            />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(r.large_spec_long)}
                            <Delta
                              curr={r.large_spec_long ?? null}
                              prev={
                                r.large_spec_long != null && r.d_large_long != null
                                  ? r.large_spec_long - r.d_large_long
                                  : null
                              }
                            />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(r.large_spec_short)}
                            <Delta
                              curr={r.large_spec_short ?? null}
                              prev={
                                r.large_spec_short != null && r.d_large_short != null
                                  ? r.large_spec_short - r.d_large_short
                                  : null
                              }
                            />
                          </td>

                          <td
                            className="px-4 py-3 tabular-nums text-slate-200"
                            style={cellHeatStyleUSD(usd)}
                          >
                            {usd == null ? "—" : fmtUSD(usd)}
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtPrice(r.report_price)}
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtPrice(r.release_price)}
                          </td>

                          <td className={`px-4 py-3 tabular-nums ${moveClass}`}>
                            {fmtPct(move)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <div>{reactionNode}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {r.price_direction ?? "—"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!recentForTable.length && (
                      <tr>
                        <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                          No rows available for this time span.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Heatmap:
              {heatMode === "off" && " off."}
              {heatMode === "z" && " relative (Z-score vs median/MAD) per column; USD uses log-scale."}
              {heatMode === "abs" && " absolute (vs p80 of |values|) per column; USD uses log-scale."}
            </div>
          </section>

          <div className="mt-2 text-xs text-slate-400">
            Range:
            {" "}
            {data.range?.from && data.range?.to
              ? `${data.range.from} → ${data.range.to}`
              : (data.range?.label ?? range).toUpperCase()}
          </div>
        </>
      )}
    </div>
  );
}