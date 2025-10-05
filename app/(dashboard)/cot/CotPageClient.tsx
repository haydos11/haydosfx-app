// app/(dashboard)/cot/CotPageClient.tsx
"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
// ❌ remove AppShell import
// import AppShell from "@/components/shell/AppShell";
import RangeControls from "./components/RangeControls";
import CurrencyStrengthChart from "./components/CurrencyStrengthChart";
import { MARKETS, type MarketInfo } from "@/lib/cot/markets";

const GROUP_LABEL: Record<MarketInfo["group"], string> = {
  FX: "Currencies",
  ENERGY: "Energies",
  METALS: "Metals",
  AGRI: "Ags/Softs",
  INDEX: "Indices",
  RATES: "Rates",
  CRYPTO: "Crypto",
  OTHER: "Other",
};

type Cat =
  | { key: "ALL"; label: string }
  | { key: MarketInfo["group"]; label: string };

const CATS: Cat[] = [
  { key: "ALL", label: "All" },
  { key: "FX", label: "Currencies" },
  { key: "ENERGY", label: "Energies" },
  { key: "INDEX", label: "Indices" },
  { key: "METALS", label: "Metals" },
  { key: "AGRI", label: "Ags/Softs" },
  { key: "RATES", label: "Rates" },
  { key: "CRYPTO", label: "Crypto" },
  { key: "OTHER", label: "Other" },
];

function fmtUSD(x: number): string {
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

type SnapshotApiRow = {
  key: string;
  code: string;
  name: string;
  group: MarketInfo["group"];
  date: string | null;
  longPct: number;
  prevLongPct: number;
  shortPct: number;
  prevShortPct: number;
  net?: number | null;
  netContracts?: number | null;
  netPos?: number | null;
  prevNet?: number | null;
  usdNotional?: number | null;
  prevUsdNotional?: number | null;
};

function pickNet(r: SnapshotApiRow): number | null {
  if (r.net != null) return r.net;
  if (r.netContracts != null) return r.netContracts;
  if (r.netPos != null) return r.netPos;
  return null;
}

type Row = {
  key: string;
  sym: string;
  name: string;
  group: MarketInfo["group"];
  sector: string;
  marketBias: "Bullish" | "Bearish";
  sentiment: "Bullish" | "Bearish" | "Increasing Bullish" | "Increasing Bearish";
  longPct: number;
  prevLongPct: number;
  shortPct: number;
  prevShortPct: number;
  netPos: number;
  prevNet: number;
  changePct: number;
  href: string;
  usdNotional: number | null;
  prevUsdNotional: number | null;
};

export default function CotPageClient({ range }: { range: string }) {
  const [view, setView] = useState<"latest" | "month">("latest");
  const [q, setQ] = useState<string>("");
  const [selectedCat, setSelectedCat] = useState<Cat["key"]>("ALL");

  const [snapRows, setSnapRows] = useState<SnapshotApiRow[]>([]);
  const [snapDate, setSnapDate] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      setSnapLoading(true);
      try {
        const res = await fetch("/api/cot/snapshot?v=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        const rows: SnapshotApiRow[] = Array.isArray(json.rows) ? json.rows : [];
        setSnapRows(rows);
        setSnapDate(rows.find((r) => r.date)?.date ?? null);
      } catch {
        /* noop */
      } finally {
        setSnapLoading(false);
      }
    })();
  }, []);

  const allRows: Row[] = useMemo(() => {
    if (!snapRows.length) return [];

    const byKey = new Map(MARKETS.map((m) => [m.key, m]));

    return snapRows
      .map((r) => {
        const mi = byKey.get(r.key);
        if (!mi) return null;

        const net = pickNet(r);
        const prev = r.prevNet ?? null;

        let changePct = 0;
        if (prev != null && prev !== 0 && net != null) {
          changePct = ((net - prev) / Math.abs(prev)) * 100;
          if (changePct > 100) changePct = 100;
          if (changePct < -100) changePct = -100;
        }

        const sentiment: Row["sentiment"] =
          changePct > 2
            ? "Increasing Bullish"
            : changePct < -2
            ? "Increasing Bearish"
            : (r.longPct ?? 0) > (r.shortPct ?? 0)
            ? "Bullish"
            : "Bearish";

        const marketBias: Row["marketBias"] = (net ?? 0) >= 0 ? "Bullish" : "Bearish";

        return {
          key: r.key,
          sym: mi.code,
          name: mi.name + (mi.group === "FX" ? ` (${mi.code})` : ""),
          group: mi.group,
          sector: GROUP_LABEL[mi.group],
          marketBias,
          sentiment,
          longPct: r.longPct ?? 0,
          prevLongPct: r.prevLongPct ?? 0,
          shortPct: r.shortPct ?? 0,
          prevShortPct: r.prevShortPct ?? 0,
          netPos: net ?? 0,
          prevNet: prev ?? 0,
          changePct,
          href: `/cot/${mi.key}?range=${encodeURIComponent(range)}`,
          usdNotional: r.usdNotional ?? null,
          prevUsdNotional: r.prevUsdNotional ?? null,
        } as Row;
      })
      .filter((x): x is Row => x !== null);
  }, [snapRows, range]);

  const filteredRows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let rows = allRows;
    if (selectedCat !== "ALL") rows = rows.filter((r) => r.group === selectedCat);
    if (ql) {
      rows = rows.filter(
        (r) =>
          r.sym.toLowerCase().includes(ql) ||
          r.name.toLowerCase().includes(ql) ||
          r.sector.toLowerCase().includes(ql)
      );
    }
    return rows;
  }, [q, allRows, selectedCat]);

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value);

  function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void; }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "rounded-full px-3 py-1.5 text-sm transition-colors",
          active ? "bg-violet-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10",
        ].join(" ")}
      >
        {children}
      </button>
    );
  }

  function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void; }) {
    return (
      <button
        type="button"
        aria-pressed={!!active}
        onClick={onClick}
        className={[
          "cursor-pointer rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/60",
          active ? "bg-violet-600 text-white ring-violet-500" : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10",
        ].join(" ")}
      >
        {children}
      </button>
    );
  }

  function Badge({ tone = "neutral", children }: { tone?: "neutral" | "up" | "down"; children: React.ReactNode; }) {
    const map = {
      neutral: "bg-white/8 text-slate-200 ring-white/10",
      up: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
      down: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
    } as const;
    return (
      <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1", map[tone]].join(" ")}>
        {children}
      </span>
    );
  }

  // ✅ No AppShell here; the route layout provides header + padding
  return (
    <div className="min-w-0">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Chip active={view === "latest"} onClick={() => setView("latest")}>Latest</Chip>
        <Chip active={view === "month"} onClick={() => setView("month")}>This Month</Chip>

        {/* Search */}
        <div className="relative ml-2 min-w-[260px] flex-1">
          <input
            value={q}
            onChange={onSearchChange}
            placeholder="Search symbols, names, or sectors…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-white/20"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
        </div>

        {/* Range presets */}
        <div className="ml-auto">
          <RangeControls />
        </div>
      </div>

      {/* Chart */}
      <section className="mt-4 min-w-0">
        <div className="overflow-x-auto">
          <CurrencyStrengthChart range={range} />
        </div>
      </section>

      {/* Category pills */}
      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <Pill key={c.key} active={selectedCat === c.key} onClick={() => setSelectedCat(c.key)}>
            {c.label.toUpperCase()}
          </Pill>
        ))}
      </div>

      {/* Table */}
      <section className="mt-8 min-w-0">
        <div className="mb-2 text-xs font-medium text-slate-400">
          Recent COT Data Analysis {snapDate ? `• Week of ${snapDate}` : ""}{snapLoading ? " • loading…" : ""}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm text-slate-300">
            <div className="font-medium">Latest snapshot</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02] text-slate-400">
                  {["Symbol","Name","Sector","Market","Sentiment","Long%","Prev Long%","Short%","Prev Short%","Net Pos","Prev Net","Change","USD Notional","Prev USD Notional"].map((h) => (
                    <th key={h} className="first:w-20 px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const tone: "up" | "down" | "neutral" = r.changePct > 0 ? "up" : r.changePct < 0 ? "down" : "neutral";
                  const biasTone: "up" | "down" = r.marketBias === "Bullish" ? "up" : "down";
                  const sentTone: "up" | "down" = /bullish/i.test(r.sentiment) ? "up" : "down";

                  return (
                    <tr key={r.key} className="border-t border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-slate-200">{r.sym}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {r.href ? (
                          <Link href={r.href} className="hover:underline" aria-label={`Open ${r.name}`}>
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.sector}</td>
                      <td className="px-4 py-3"><Badge tone={biasTone}>{r.marketBias}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={sentTone}>{r.sentiment}</Badge></td>
                      <td className="tabular-nums px-4 py-3 text-slate-200">{r.longPct.toFixed(2)}%</td>
                      <td className="tabular-nums px-4 py-3 text-slate-400">{r.prevLongPct.toFixed(2)}%</td>
                      <td className="tabular-nums px-4 py-3 text-slate-200">{r.shortPct.toFixed(2)}%</td>
                      <td className="tabular-nums px-4 py-3 text-slate-400">{r.prevShortPct.toFixed(2)}%</td>
                      <td className="tabular-nums px-4 py-3 text-slate-200">{r.netPos == null ? "—" : r.netPos.toLocaleString()}</td>
                      <td className="tabular-nums px-4 py-3 text-slate-400">{r.prevNet == null ? "—" : r.prevNet.toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge tone={tone}>{r.changePct > 0 ? "+" : ""}{r.changePct.toFixed(2)}%</Badge></td>
                      <td className="tabular-nums px-4 py-3 text-slate-200">{r.usdNotional == null ? "—" : fmtUSD(r.usdNotional)}</td>
                      <td className="tabular-nums px-4 py-3 text-slate-400">{r.prevUsdNotional == null ? "—" : fmtUSD(r.prevUsdNotional)}</td>
                    </tr>
                  );
                })}

                {!snapLoading && filteredRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-400" colSpan={14}>No results</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
