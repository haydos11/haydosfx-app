"use client";

import TradingViewWidget from "./TradingViewWidget";

type Props = {
  symbol: string;
  timeframe: string;
};

export default function FxChartPanel({ symbol, timeframe }: Props) {
  const intervalMap: Record<string, string> = {
    M5: "5",
    M15: "15",
    M30: "30",
    H1: "60",
    H4: "240",
    D1: "1D",
  };

  const interval = intervalMap[timeframe] ?? "60";

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black p-4 shadow-2xl">
      <TradingViewWidget symbol={symbol} interval={interval} />
    </div>
  );
}