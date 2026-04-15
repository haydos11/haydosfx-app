"use client";

import RiskSentiment from "./components/RiskSentiment";
import CurrencyHeatmap from "./components/CurrencyHeatmap";
import SessionRibbon from "./components/SessionRibbon";
import MarketTimeline from "./components/MarketTimeline";

function BoardCardShell({
  title,
  subtitle,
  children,
  minHeight = "min-h-[320px]",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  minHeight?: string;
}) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.98),rgba(10,12,18,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.30)]">
      <div className="mb-4">
        <h2 className="text-[22px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div
        className={`rounded-[20px] border border-white/10 bg-black/20 ${minHeight} flex items-center justify-center text-sm text-white/35`}
      >
        {children}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#07090f]">
      <div className="mx-auto w-full max-w-[1750px] px-4 py-5 sm:px-6 xl:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-white">
              Market Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Cross-asset sentiment, currency leadership, and session context
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-white/8 bg-white/[0.02] p-2">
            <MarketTimeline />
          </div>

          <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-2">
            <SessionRibbon />
          </div>

          <div className="grid grid-cols-1 gap-5">
            <RiskSentiment />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.98),rgba(10,12,18,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.30)]">
              <CurrencyHeatmap />
            </div>

            <BoardCardShell
              title="Macro Board"
              subtitle="Rates, indices, commodities, and market context overlays"
              minHeight="min-h-[360px]"
            >
              Coming Soon
            </BoardCardShell>
          </div>
        </div>
      </div>
    </div>
  );
}