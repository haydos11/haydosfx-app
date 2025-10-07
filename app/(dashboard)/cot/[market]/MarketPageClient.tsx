// app/(dashboard)/cot/[market]/MarketPageClient.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
// ❌ removed: import AppShell from "@/components/shell/AppShell";
import type { CotSeries } from "@/lib/cot/shape";
import RangeControls from "../components/RangeControls";

// heavy charts split out (echarts inside)
const CotCharts = dynamic(() => import("../components/CotCharts"), { ssr: false });

type RecentRow = {
  date: string;
  open_interest: number | null;
  large_spec_net: number;
  small_traders_net: number;
  commercials_net: number;
  large_spec_long: number;
  large_spec_short: number;
};

type UsdPoint = { date: string; netNotionalUSD: number | null };

type WithUsdPoints = Omit<CotSeries, "recent"> & {
  recent: RecentRow[];
  points?: UsdPoint[];
  range?: { from: string; to: string; label: string };
};

/* ---------------- helpers (unchanged) ---------------- */
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
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function median(arr: number[]) { if (!arr.length) return 0; const a=[...arr].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function mad(arr: number[], med: number) { if (!arr.length) return 0; const dev=arr.map(v=>Math.abs(v-med)).sort((x,y)=>x-y); const m=Math.floor(dev.length/2); const raw=dev.length%2?dev[m]:(dev[m-1]+dev[m])/2; return raw*1.4826; }
function percentile(arr: number[], p: number) { if (!arr.length) return 0; const a=[...arr].sort((x,y)=>x-y); const i=(a.length-1)*clamp01(p); const lo=Math.floor(i), hi=Math.ceil(i); if (lo===hi) return a[lo]; const t=i-lo; return a[lo]*(1-t)+a[hi]*t; }

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
  if (abs <= 0 || !Number.isFinite(minLog) || !Number.isFinite(maxLog) || maxLog <= minLog) return null;
  const t = clamp01((Math.log10(abs) - minLog) / (maxLog - minLog));
  const alpha = 0.06 + 0.4 * Math.pow(t, 0.95);
  const hue = value >= 0 ? 156 : 350;
  return `hsla(${hue},72%,42%,${alpha})`;
}

/* ---------------- Page ---------------- */
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
    (async () => {
      try {
        const res = await fetch(
          `/api/cot/market/${encodeURIComponent(market)}?range=${encodeURIComponent(apiRange)}&basis=usd`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `API ${res.status}`);
        const json: WithUsdPoints = await res.json();
        setData(json);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [market, apiRange]);

  const recentForTable: RecentRow[] = useMemo(() => {
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
      const usd = data?.points?.find((p) => p.date === r.date)?.netNotionalUSD ?? null;

      if (lsn != null) { lsnVals.push(lsn); lsnAbs.push(Math.abs(lsn)); }
      if (com != null) { comVals.push(com); comAbs.push(Math.abs(com)); }
      if (usd != null && Math.abs(usd) > 0) usdAbsLogs.push(Math.log10(Math.abs(usd)));
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
  }, [recentForTable, data?.points]);

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

  // ⬇️ content only (no AppShell)
  return (
    <div className="min-w-0 space-y-8">
      <div className="mb-4 text-sm">
        <Link href={`/cot?range=${encodeURIComponent(range)}`} className="text-slate-400 hover:text-slate-200">
          ← Back to COT Report
        </Link>
      </div>

      {err && <div className="text-rose-400">{err}</div>}
      {!data && !err && <div className="text-slate-300">Loading…</div>}

      {data && (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-2xl font-semibold">
              {data.market.code} — {data.market.name}
            </h1>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">Updated {new Date(data.updated).toLocaleString()}</div>
              <RangeControls />
            </div>
          </div>

          <CotCharts series={data} height={260} compact />

          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium text-slate-400">
                Recent values ({data.market.code})
              </div>

              <div className="flex items-center gap-3">
                <div className="flex rounded-full bg-white/5 p-0.5 ring-1 ring-inset ring-white/10">
                  {(["3m", "1y", "3y", "5y"] as const).map((span) => (
                    <button
                      key={span}
                      onClick={() => setTableSpan(span)}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs transition-colors",
                        tableSpan === span ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/10",
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
                          heatMode === mode ? "bg-violet-600 text-white" : "text-slate-300 hover:bg-white/10",
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
                      <th className="px-4 py-3 text-left font-medium">Open Interest</th>
                      <th className="px-4 py-3 text-left font-medium">Small Traders Net</th>
                      <th className="px-4 py-3 text-left font-medium">Commercials Net</th>
                      <th className="px-4 py-3 text-left font-medium">Large Specs Net</th>
                      <th className="px-4 py-3 text-left font-medium">Large Specs Long</th>
                      <th className="px-4 py-3 text-left font-medium">Large Specs Short</th>
                      <th className="px-4 py-3 text-left font-medium">USD Notional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentForTable.map((r, idx, arr) => {
                      const prev = arr[idx + 1];
                      const usd = data.points?.find((p) => p.date === r.date)?.netNotionalUSD ?? null;

                      const lsLong = r.large_spec_long ?? null;
                      const lsShort = r.large_spec_short ?? null;
                      const prevLong = prev?.large_spec_long ?? null;
                      const prevShort = prev?.large_spec_short ?? null;

                      const stn = r.small_traders_net ?? null;
                      const com = r.commercials_net ?? null;
                      const lsn = r.large_spec_net ?? null;

                      return (
                        <tr key={r.date ?? idx} className="border-t border-white/5 hover:bg-white/[0.03]">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-200">{r.date}</td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(r.open_interest)}
                            <Delta curr={r.open_interest ?? null} prev={prev?.open_interest ?? null} />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(stn)}
                            <Delta curr={stn} prev={prev?.small_traders_net ?? null} />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200" style={cellHeatStyleCOM(com)}>
                            {fmtNum(com)}
                            <Delta curr={com} prev={prev?.commercials_net ?? null} />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200" style={cellHeatStyleLSN(lsn)}>
                            {fmtNum(lsn)}
                            <Delta curr={lsn} prev={prev?.large_spec_net ?? null} />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(lsLong)}
                            <Delta curr={lsLong} prev={prevLong} />
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-200">
                            {fmtNum(lsShort)}
                            <Delta curr={lsShort} prev={prevShort} />
                          </td>

                          <td className="px-4 py-3 tabular-nums text-slate-200" style={cellHeatStyleUSD(usd)}>
                            {usd == null ? "—" : fmtUSD(usd)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Heatmap:
              {heatMode === "off" && " off."}
              {heatMode === "z" && " relative (Z-score vs median/MAD) per column; USD uses log-scale."}
              {heatMode === "abs" && " absolute (vs p80 of |values|) per column; USD uses log-scale."}
            </div>
          </section>

          <div className="mt-2 text-xs text-slate-400">
            Range: {data.range?.from ?? "…"} → {data.range?.to ?? "…"}
          </div>
        </>
      )}
    </div>
  );
}
