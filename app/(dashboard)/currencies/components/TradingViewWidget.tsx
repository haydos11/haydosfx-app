// app/(dashboard)/currencies/components/TradingViewWidget.tsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";

type Interval = "1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W";
type Theme = "light" | "dark";

interface TradingViewWidgetOptions {
  symbol: string;
  interval?: Interval;
  theme?: Theme;
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
}

interface TradingViewGlobal {
  widget: new (options: TradingViewWidgetOptions) => TradingViewWidgetInstance;
}

declare global {
  interface Window {
    TradingView?: TradingViewGlobal;
  }
}

/**
 * Load TradingView tv.js once per page session.
 * Uses a DOM marker attribute to avoid double-injecting the script.
 */
function loadTvScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView?.widget) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-tradingview-tvjs="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load TradingView tv.js")),
        { once: true }
      );
      return;
    }

    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.defer = true;
    s.dataset.tradingviewTvjs = "true";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load TradingView tv.js"));
    document.head.appendChild(s);
  });
}

export type TradingViewWidgetProps = {
  symbol: string;
  interval?: Interval;
  theme?: Theme;
  locale?: string;

  /** Studies: e.g. ["RSI@tv-basicstudies", "MACD@tv-basicstudies"] */
  studies?: string[];

  hideTopToolbar?: boolean;
  hideSideToolbar?: boolean;

  /**
   * Optional: allow TradingView to autosize internally.
   * NOTE: We STILL enforce a real height on the container to avoid 0px issues.
   */
  autosize?: boolean;

  /** Container height in px (always applied to prevent zero-height). */
  height?: number;

  className?: string;
};

export default function TradingViewWidget({
  symbol,
  interval = "60",
  theme = "dark",
  locale = "en",
  studies = [],
  hideTopToolbar = false,
  hideSideToolbar = false,
  autosize = true,
  height = 520,
  className = "",
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TradingViewWidgetInstance | null>(null);

  // Stabilize studies dependency even if caller passes inline array literals
  const studiesKey = useMemo(() => JSON.stringify(studies), [studies]);

  // Stable container id
  const containerIdRef = useRef<string>(
    "tv_" + Math.random().toString(36).slice(2)
  );

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const el = containerRef.current;
      if (!el) return;

      el.id = containerIdRef.current;

      // Clear any leftover content (important when re-initing)
      el.innerHTML = "";

      await loadTvScript();
      if (cancelled || !containerRef.current) return;

      // remove previous widget (best-effort)
      try {
        widgetRef.current?.remove?.();
      } catch {
        // noop
      }

      // Clear again after remove
      el.innerHTML = "";

      const opts: TradingViewWidgetOptions = {
        symbol,
        interval,
        theme,
        locale,
        autosize: !!autosize,

        container_id: el.id,
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

      if (window.TradingView?.widget) {
        widgetRef.current = new window.TradingView.widget(opts);
      }
    }

    void mount();

    return () => {
      cancelled = true;
      try {
        widgetRef.current?.remove?.();
      } catch {
        // noop
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [
    symbol,
    interval,
    theme,
    locale,
    hideTopToolbar,
    hideSideToolbar,
    autosize,
    height,
    studiesKey,
  ]);

  // Always set a real height to avoid collapsing to 0px (common autosize pitfall).
  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height, minHeight: height }}
      className={`rounded-2xl overflow-hidden border border-white/10 ${className}`}
    />
  );
}