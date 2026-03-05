"use client";

import RiskSentiment from "./components/RiskSentiment";
import CurrencyHeatmap from "./components/CurrencyHeatmap";
import SessionRibbon from "./components/SessionRibbon";
import MarketTimeline from "./components/MarketTimeline";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Market Dashboard</h1>

      {/* Ribbon goes best full width */}
      <SessionRibbon />

      {/* widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <RiskSentiment />
        <CurrencyHeatmap />
        <div className="bg-zinc-900 p-4 rounded-xl flex items-center justify-center text-sm text-white/50">
          Coming Soon
        </div>
      </div>

      <MarketTimeline />
    </div>
  );
}