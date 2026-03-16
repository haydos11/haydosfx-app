"use client";

import { useMemo, useState } from "react";
import CandlesChart from "@/components/charts/CandlesChart";
import CurrencyStrengthPreview from "@/components/charts/CurrencyStrengthPreview";

const SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY",
] as const;

const TIMEFRAMES = ["M5", "H1"] as const;

const SHOW_MT5_CANDLES = false;

export default function CurrencyStrengthPage() {
  const [symbol, setSymbol] = useState<(typeof SYMBOLS)[number]>("EURUSD");
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("M5");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const title = useMemo(
    () => `${symbol} · ${timeframe} Chart`,
    [symbol, timeframe]
  );

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black p-6 shadow-2xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

            <div>
              <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
                Market Data Lab
              </div>

              <h1 className="text-3xl font-semibold tracking-tight">
                Currency Strength
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Internal page for testing your MT5 pipeline, read API, charting
                stack, and future strength engine visuals.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <label className="min-w-[160px]">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Symbol
                </div>

                <select
                  value={symbol}
                  onChange={(e) =>
                    setSymbol(e.target.value as (typeof SYMBOLS)[number])
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                >
                  {SYMBOLS.map((item) => (
                    <option key={item} value={item} className="bg-slate-900">
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-[140px]">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Timeframe
                </div>

                <select
                  value={timeframe}
                  onChange={(e) =>
                    setTimeframe(e.target.value as (typeof TIMEFRAMES)[number])
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                >
                  {TIMEFRAMES.map((item) => (
                    <option key={item} value={item} className="bg-slate-900">
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-[170px] items-end">
                <button
                  type="button"
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm transition ${
                    autoRefresh
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Auto Refresh: {autoRefresh ? "On" : "Off"}
                </button>
              </label>

            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black p-4 shadow-2xl">
          <CurrencyStrengthPreview limitM5={1200} limitH1={2500} />
        </div>

        {SHOW_MT5_CANDLES ? (
          <CandlesChart
            symbol={symbol}
            timeframe={timeframe}
            limit={500}
            height={560}
            title={title}
            autoRefreshMs={autoRefresh ? 15000 : null}
          />
        ) : (
          <div className="flex h-[600px] w-full items-center justify-center rounded-3xl border border-white/10 bg-black text-slate-400">
            TradingView chart temporarily disabled while widget is stabilised
          </div>
        )}

      </div>
    </main>
  );
}