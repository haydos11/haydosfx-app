"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => {
        remove?: () => void;
      };
    };
  }
}

type Props = {
  symbol: string;
  interval: string;
};

export default function TradingViewWidget({ symbol, interval }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerId = container.id;

    const loadWidget = () => {
      if (!window.TradingView) return;

      if (widgetRef.current?.remove) {
        widgetRef.current.remove();
      }

      container.innerHTML = "";

      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: `FX:${symbol}`,
        interval,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        container_id: containerId,
        allow_symbol_change: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
      });
    };

    if (!window.TradingView) {
      const existingScript = document.querySelector(
        'script[src="https://s3.tradingview.com/tv.js"]'
      );

      if (existingScript) {
        const waitForTradingView = window.setInterval(() => {
          if (window.TradingView) {
            window.clearInterval(waitForTradingView);
            loadWidget();
          }
        }, 100);

        return () => {
          window.clearInterval(waitForTradingView);
          if (widgetRef.current?.remove) {
            widgetRef.current.remove();
          }
        };
      }

      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = loadWidget;
      document.body.appendChild(script);
    } else {
      loadWidget();
    }

    return () => {
      if (widgetRef.current?.remove) {
        widgetRef.current.remove();
      }
    };
  }, [symbol, interval]);

  return (
    <div
      id={`tradingview_chart_${symbol}_${interval}`}
      ref={containerRef}
      className="h-[600px] w-full"
    />
  );
}