"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MarketInfo } from "@/lib/cot/markets";
import { Info } from "lucide-react";
import TestCurrencyStrengthChart from "./TestCurrencyStrengthChart";

type TestSnapshotRow = {
  market_code: string;
  key: string;
  code: string;
  name: string;
  group: MarketInfo["group"] | "OTHER";
  category: string | null;
  date: string | null;

  longPct: number | null;
  prevLongPct: number | null;
  shortPct: number | null;
  prevShortPct: number | null;

  marketBias: string | null;
  sentiment: string | null;

  netContracts: number | null;
  prevNet: number | null;
  changePct: number | null;
  weeklyChange: number | null;
  netPctOi: number | null;

  usdDirectional: number | null;
  prevUsdDirectional: number | null;

  bias?: string | null;
  reportPrice?: number | null;
  releasePrice?: number | null;
  movePct?: number | null;
  priceDirection?: string | null;
  reaction?: string | null;
};

const CATS: Array<"ALL" | MarketInfo["group"] | "OTHER"> = [
  "ALL",
  "FX",
  "ENERGY",
  "INDEX",
  "METALS",
  "AGRI",
  "RATES",
  "CRYPTO",
  "OTHER",
];

function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString();
}

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v.toFixed(2)}%`;
}

function fmtPctSigned(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtPx(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(5);
}

function fmtUsdDirectional(v: number | null | undefined) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "up" | "down" | "warn";
  children: React.ReactNode;
}) {
  const map = {
    neutral: "bg-white/6 text-slate-300 ring-white/10",
    up: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    down: "bg-rose-500/10 text-rose-300 ring-rose-500/20",
    warn: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  } as const;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        map[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function biasTone(v: string | null | undefined): "neutral" | "up" | "down" {
  if (!v) return "neutral";
  return /bullish/i.test(v) ? "up" : /bearish/i.test(v) ? "down" : "neutral";
}

function sentimentTone(
  v: string | null | undefined
): "neutral" | "up" | "down" | "warn" {
  if (!v) return "neutral";
  if (/increasing bullish/i.test(v)) return "up";
  if (/increasing bearish/i.test(v)) return "down";
  if (/less bullish/i.test(v) || /less bearish/i.test(v)) return "warn";
  return /bullish/i.test(v) ? "up" : /bearish/i.test(v) ? "down" : "neutral";
}

function reactionTone(v: string | null | undefined): "neutral" | "up" | "warn" {
  if (v === "confirmation") return "up";
  if (v === "fade") return "warn";
  return "neutral";
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
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs leading-5 text-slate-300 shadow-2xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

function reactionHelpText() {
  return "Confirmation means price moved in the same direction as positioning into release. Fade means price moved against the positioning read into release, suggesting divergence, squeeze, or distribution.";
}

function sectorLabel(group: TestSnapshotRow["group"]) {
  if (group === "FX") return "Currencies";
  if (group === "ENERGY") return "Energies";
  if (group === "METALS") return "Metals";
  if (group === "AGRI") return "Agri";
  return group;
}

export default function TestCotPageClient() {
  const [rows, setRows] = useState<TestSnapshotRow[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");
  const [range, setRange] = useState("1y");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cot/test-snapshot?v=" + Date.now(), {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setDate(json.date ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();

    return rows.filter((r) => {
      const catOk = cat === "ALL" || r.group === cat;
      const qOk =
        !search ||
        r.code.toLowerCase().includes(search) ||
        r.name.toLowerCase().includes(search) ||
        r.group.toLowerCase().includes(search) ||
        (r.marketBias ?? "").toLowerCase().includes(search) ||
        (r.sentiment ?? "").toLowerCase().includes(search) ||
        (r.reaction ?? "").toLowerCase().includes(search);

      return catOk && qOk;
    });
  }, [rows, q, cat]);

  const summary = useMemo(() => {
    const fxRows = rows.filter((r) => r.group === "FX");
    const usdDirectional = fxRows.reduce(
      (sum, row) => sum + (row.usdDirectional ?? 0),
      0
    );

    const confirmations = fxRows.filter((r) => r.reaction === "confirmation").length;
    const fades = fxRows.filter((r) => r.reaction === "fade").length;

    return {
      totalMarkets: rows.length,
      fxMarkets: fxRows.length,
      usdDirectional,
      confirmations,
      fades,
    };
  }, [rows]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Latest week
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {date ?? "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Markets loaded
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {summary.totalMarkets}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            FX directional USD basket
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {fmtUsdDirectional(summary.usdDirectional)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            FX confirmations
          </div>
          <div className="mt-2 text-lg font-semibold text-emerald-300">
            {summary.confirmations}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            FX fades
          </div>
          <div className="mt-2 text-lg font-semibold text-amber-300">
            {summary.fades}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {["1y", "ytd", "3y", "5y"].map((r) => (
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
        </div>
      </div>

      <TestCurrencyStrengthChart range={range} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbol, market, sector, sentiment, or reaction..."
          className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-white/20"
        />

        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={[
                "rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors",
                cat === c
                  ? "bg-violet-600 text-white ring-violet-500"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10",
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-400">
        Latest DB-backed COT snapshot {date ? `• Week of ${date}` : ""}
        {loading ? " • loading..." : ""}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400">
                <th className="px-4 py-3 text-left font-medium">Symbol</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Sector</th>
                <th className="px-4 py-3 text-left font-medium">Market</th>
                <th className="px-4 py-3 text-left font-medium">Sentiment</th>
                <th className="px-4 py-3 text-left font-medium">Long%</th>
                <th className="px-4 py-3 text-left font-medium">Prev Long%</th>
                <th className="px-4 py-3 text-left font-medium">Short%</th>
                <th className="px-4 py-3 text-left font-medium">Prev Short%</th>
                <th className="px-4 py-3 text-left font-medium">Net Pos</th>
                <th className="px-4 py-3 text-left font-medium">Prev Net</th>
                <th className="px-4 py-3 text-left font-medium">Change</th>
                <th className="px-4 py-3 text-left font-medium">USD Notional</th>
                <th className="px-4 py-3 text-left font-medium">Prev USD Notional</th>
                <th className="px-4 py-3 text-left font-medium min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span>Price Move</span>
                    <TooltipInfo text={reactionHelpText()} />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const hasFxReaction =
                  r.reportPrice != null || r.releasePrice != null || r.movePct != null;

                return (
                  <tr
                    key={`${r.market_code}-${r.date}`}
                    className="border-t border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5 text-slate-200">{r.code}</td>

                    <td className="px-4 py-2.5 text-slate-200">
                      <Link
                        href={`/test-cot/${encodeURIComponent(r.key)}?range=${encodeURIComponent(range)}`}
                        className="hover:text-violet-300 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>

                    <td className="px-4 py-2.5 text-slate-300">
                      {sectorLabel(r.group)}
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge tone={biasTone(r.marketBias)}>{r.marketBias ?? "—"}</Badge>
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge tone={sentimentTone(r.sentiment)}>{r.sentiment ?? "—"}</Badge>
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtPct(r.longPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtPct(r.prevLongPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtPct(r.shortPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtPct(r.prevShortPct)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtNum(r.netContracts)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtNum(r.prevNet)}
                    </td>

                    <td className="px-4 py-2.5">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                          (r.changePct ?? 0) > 0
                            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                            : (r.changePct ?? 0) < 0
                            ? "bg-rose-500/10 text-rose-300 ring-rose-500/20"
                            : "bg-white/6 text-slate-300 ring-white/10",
                        ].join(" ")}
                      >
                        {fmtPctSigned(r.changePct)}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-100">
                      {fmtUsdDirectional(r.usdDirectional)}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums text-slate-400">
                      {fmtUsdDirectional(r.prevUsdDirectional)}
                    </td>

                    <td className="px-4 py-2.5">
                      {hasFxReaction ? (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums text-slate-100">
                              {fmtPctSigned(r.movePct)}
                            </span>
                            <Badge tone={reactionTone(r.reaction)}>
                              {r.reaction
                                ? r.reaction.charAt(0).toUpperCase() + r.reaction.slice(1)
                                : "—"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {fmtPx(r.reportPrice)} → {fmtPx(r.releasePrice)}
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="tabular-nums text-slate-100">—</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            Report: {fmtPx(r.reportPrice)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-4 py-6 text-slate-400">
                    No results
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