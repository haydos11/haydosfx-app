// app/(dashboard)/currencies/components/TradingViewWidget.tsx
"use client";
import React, { useEffect, useRef } from "react";

/* ----------------------- Minimal TradingView types ----------------------- */
interface TradingViewWidgetOptions {
  symbol: string;
  interval?: "1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W";
  theme?: "light" | "dark";
  locale?: string;
  autosize?: boolean;
  container_id: string;
  hide_top_toolbar?: boolean;
  hide_side_toolbar?: boolean;
  studies?: string[];
  allow_symbol_change?: boolean;
  toolbar_bg?: string;
  timezone?: string;
  style?: string | number;
  withdateranges?: boolean;
  details?: boolean;
  calendar?: boolean;
  disabled_features?: string[];
}

interface TradingViewWidgetInstance {
  remove?: () => void;
  // Extend if you use more methods (onChartReady, etc.)
}

interface TradingViewGlobal {
  widget: new (options: TradingViewWidgetOptions) => TradingViewWidgetInstance;
}

declare global {
  interface Window {
    TradingView?: TradingViewGlobal;
    __tvScriptLoaded?: boolean;
  }
}

type TVProps = {
  symbol: string;
  interval?: "1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W";
  theme?: "light" | "dark";
  studies?: string[];
  autosize?: boolean;
  hideTopToolbar?: boolean;
  hideSideToolbar?: boolean;
  locale?: string;
  height?: number;
};

/* --------------------------- Loader for tv.js --------------------------- */
const loadTvScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.__tvScriptLoaded) return resolve();
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => {
      window.__tvScriptLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load TradingView tv.js"));
    document.head.appendChild(s);
  });

/* ------------------------------ Component ------------------------------ */
export default function TradingViewWidget({
  symbol,
  interval = "60",
  theme = "dark",
  studies = [],
  autosize = true,
  hideTopToolbar = false,
  hideSideToolbar = false,
  locale = "en",
  height = 520,
}: TVProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TradingViewWidgetInstance | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      await loadTvScript();
      if (cancelled) return;

      // Clean up existing widget if any
      if (widgetRef.current?.remove) {
        try {
          widgetRef.current.remove();
        } catch {
          /* noop */
        }
      }

      // Build options
      const opts: TradingViewWidgetOptions = {
        symbol,
        interval,
        theme,
        locale,
        autosize,
        container_id: containerRef.current.id,
        hide_top_toolbar: hideTopToolbar,
        hide_side_toolbar: hideSideToolbar,
        studies,
        allow_symbol_change: true,
        toolbar_bg: theme === "dark" ? "#0b0b0b" : "#ffffff",
        timezone: "Etc/UTC",
        style: "1",
        withdateranges: true,
        details: false,
        calendar: false,
        disabled_features: [
          "header_compare",
          "create_volume_indicator_by_default",
          "timeframes_toolbar",
        ],
      };

      if (window.TradingView) {
        widgetRef.current = new window.TradingView.widget(opts);
      } else {
        // tv.js didn't attach properly (rare)
        // console.warn("TradingView not available on window.");
      }
    }

    // Ensure container has an id for TradingView to mount into
    if (containerRef.current && !containerRef.current.id) {
      containerRef.current.id = "tv_" + Math.random().toString(36).slice(2);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [
    symbol,
    interval,
    theme,
    autosize,
    hideTopToolbar,
    hideSideToolbar,
    locale,
    studies, // ✅ include the array itself
  ]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: autosize ? "100%" : height }}
      className="rounded-2xl overflow-hidden border border-white/10"
    />
  );
}
