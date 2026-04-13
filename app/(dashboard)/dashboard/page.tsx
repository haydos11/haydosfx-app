"use client";

import RiskSentiment from "./components/RiskSentiment";
import CurrencyHeatmap from "./components/CurrencyHeatmap";
import SessionRibbon from "./components/SessionRibbon";
import MarketTimeline from "./components/MarketTimeline";

function PlaceholderCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,24,0.96),rgba(10,12,18,0.96))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <div className="mb-3">
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="flex min-h-[280px] items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] text-sm text-white/40">
        Coming Soon
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0a0c12]">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold tracking-tight text-white">
              Market Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Cross-asset sentiment, currency leadership, and session context
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <MarketTimeline />
          <SessionRibbon />

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.45fr_0.95fr]">
            <div className="space-y-5">
              <RiskSentiment />
            </div>

            <div className="space-y-5">
              <CurrencyHeatmap />
              <PlaceholderCard
                title="Macro Board"
                subtitle="Rates, indices, commodities, and market context overlays"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}