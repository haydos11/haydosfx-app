"use client";
import React from "react";
import TradingViewWidget from "./TradingViewWidget";
import { Search, Settings2 } from "lucide-react";

const SYMBOLS = [
  { label: "EURUSD", tv: "OANDA:EURUSD" },
  { label: "GBPUSD", tv: "OANDA:GBPUSD" },
  { label: "USDJPY", tv: "OANDA:USDJPY" },
  { label: "AUDUSD", tv: "OANDA:AUDUSD" },
  { label: "NZDUSD", tv: "OANDA:NZDUSD" },
  { label: "USDCAD", tv: "OANDA:USDCAD" },
  { label: "USDCHF", tv: "OANDA:USDCHF" },
  { label: "DXY",    tv: "TVC:DXY" },
] as const;

const INTRVALS = ["1","5","15","60","240","D"] as const;

export default function FxChartPanel() {
  const [symbol, setSymbol] = React.useState<string>(SYMBOLS[0].tv);
  const [custom, setCustom] = React.useState<string>("");
  const [interval, setInterval] = React.useState<(typeof INTRVALS)[number]>("60");
  const [theme, setTheme] = React.useState<"light"|"dark">("dark");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = custom.trim();
    if (s) setSymbol(s.toUpperCase());
  };

  return (
    <div className="w-full space-y-3">
      {/* header row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Asset</span>
          <div className="flex flex-wrap gap-2">
            {SYMBOLS.map((s) => {
              const active = symbol === s.tv;
              return (
                <button
                  key={s.label}
                  onClick={() => setSymbol(s.tv)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition
                    ${active ? "border-indigo-400/50 text-indigo-300 bg-indigo-500/10" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 rounded-xl border border-white/10 p-1">
            {INTRVALS.map((iv) => {
              const active = interval === iv;
              return (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition
                    ${active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"}`}
                >
                  {iv}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="px-3 py-1 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5"
            title="Toggle theme"
          >
            {theme === "dark" ? "Dark" : "Light"}
          </button>

          <button
            className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5"
            title="Chart settings"
          >
            <Settings2 className="h-4 w-4" /> Settings
          </button>
        </div>
      </div>

      {/* search */}
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder='Search symbol (e.g. "OANDA:EURUSD", "FX:GBPUSD", "TVC:DXY")'
            className="w-full rounded-xl border border-white/10 bg-[#0b0b0b] px-9 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"
        >
          Load
        </button>
      </form>

      {/* chart */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0b0b]/70 p-3">
        <div className="h-[64vh] w-full">
          <TradingViewWidget
            symbol={symbol}
            interval={interval}
            theme={theme}
            autosize
            hideTopToolbar={false}
            hideSideToolbar={false}
            studies={[]}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <div className="font-semibold">HTF Bias</div>
            <div className="opacity-80">—</div>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
            <div className="font-semibold">Intraday</div>
            <div className="opacity-80">—</div>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          Note: Programmatic chart drawings require TradingView’s Charting Library.
        </p>
      </div>
    </div>
  );
}
