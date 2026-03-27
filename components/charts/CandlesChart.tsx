"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { RefreshCw, Search, TrendingUp } from "lucide-react";

type CandleApiRow = {
  symbol: string;
  timeframe: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tick_volume?: number | null;
  spread?: number | null;
  real_volume?: number | null;
  source?: string;
};

type CandleApiResponse = {
  ok: boolean;
  symbol?: string;
  timeframe?: string;
  count?: number;
  candles?: CandleApiRow[];
  error?: string;
};

type CandlesChartProps = {
  symbol: string;
  timeframe: string;
  limit?: number;
  height?: number;
  title?: string;
  autoRefreshMs?: number | null;
};

type ChartCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

type LinePoint = {
  time: Time;
  value: number;
};

const LOAD_MORE_THRESHOLD_BARS = 40;
const LOAD_MORE_STEP = 500;
const MAX_LIMIT = 20000;

function normalizeSymbolInput(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function toChartData(rows: CandleApiRow[]): ChartCandle[] {
  return rows
    .map((row) => ({
      time: Math.floor(new Date(row.time).getTime() / 1000) as UTCTimestamp,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.time) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close)
    )
    .sort((a, b) => Number(a.time) - Number(b.time));
}

function formatPrice(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  return n.toFixed(5);
}

function calcChangePercent(first?: number, last?: number) {
  if (
    typeof first !== "number" ||
    typeof last !== "number" ||
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    first === 0
  ) {
    return null;
  }
  return ((last - first) / first) * 100;
}

function buildSma20(data: ChartCandle[]): LinePoint[] {
  const result: LinePoint[] = [];
  const period = 20;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }

  return result;
}

function sameLogicalRange(a: LogicalRange | null, b: LogicalRange | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.from === b.from && a.to === b.to;
}

export default function CandlesChart({
  symbol,
  timeframe,
  limit = 1000,
  height = 520,
  title,
  autoRefreshMs = null,
}: CandlesChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [activeSymbol, setActiveSymbol] = useState(() => normalizeSymbolInput(symbol));
  const [symbolInput, setSymbolInput] = useState(() => normalizeSymbolInput(symbol));
  const [currentLimit, setCurrentLimit] = useState(() =>
    Math.min(Math.max(limit, 300), MAX_LIMIT)
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const lastRequestedKeyRef = useRef<string>("");
  const initialFitDoneRef = useRef(false);
  const preserveRangeRef = useRef<LogicalRange | null>(null);
  const isFetchingMoreRef = useRef(false);
  const latestCandlesRef = useRef<ChartCandle[]>([]);
  const currentLimitRef = useRef(currentLimit);

  useEffect(() => {
    latestCandlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    currentLimitRef.current = currentLimit;
  }, [currentLimit]);

  useEffect(() => {
    const normalized = normalizeSymbolInput(symbol);
    setActiveSymbol(normalized);
    setSymbolInput(normalized);
    setCurrentLimit(Math.min(Math.max(limit, 300), MAX_LIMIT));
    initialFitDoneRef.current = false;
  }, [symbol, limit]);

  const heading = useMemo(
    () => title ?? `${activeSymbol} ${timeframe}`,
    [activeSymbol, timeframe, title]
  );

  const latest = candles.length ? candles[candles.length - 1] : null;
  const earliest = candles.length ? candles[0] : null;
  const changePct = calcChangePercent(earliest?.close, latest?.close);

  const applyTypedSymbol = useCallback(() => {
    const normalized = normalizeSymbolInput(symbolInput);
    if (!normalized) return;
    if (normalized === activeSymbol) return;
    setActiveSymbol(normalized);
    setCurrentLimit(Math.min(Math.max(limit, 300), MAX_LIMIT));
    setCandles([]);
    setError(null);
    initialFitDoneRef.current = false;
    preserveRangeRef.current = null;
  }, [symbolInput, activeSymbol, limit]);

  const loadCandles = useCallback(
    async ({
      isManualRefresh = false,
      nextLimit,
      preserveRange,
      isLoadMore = false,
    }: {
      isManualRefresh?: boolean;
      nextLimit?: number;
      preserveRange?: LogicalRange | null;
      isLoadMore?: boolean;
    } = {}) => {
      const effectiveLimit = Math.min(
        Math.max(nextLimit ?? currentLimitRef.current, 300),
        MAX_LIMIT
      );

      const requestKey = `${activeSymbol}|${timeframe}|${effectiveLimit}`;
      lastRequestedKeyRef.current = requestKey;

      try {
        if (isLoadMore) {
          isFetchingMoreRef.current = true;
          setLoadingMore(true);
        } else if (isManualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        const url = `/api/market/candles?symbol=${encodeURIComponent(
          activeSymbol
        )}&timeframe=${encodeURIComponent(timeframe)}&limit=${effectiveLimit}`;

        const res = await fetch(url, { cache: "no-store" });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(`API returned non-JSON response: ${text.slice(0, 200)}`);
        }

        const json = (await res.json()) as CandleApiResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Request failed with status ${res.status}`);
        }

        if (lastRequestedKeyRef.current !== requestKey) return;

        const rows = Array.isArray(json.candles) ? json.candles : [];
        const mapped = toChartData(rows);

        preserveRangeRef.current = preserveRange ?? null;
        setCandles(mapped);
        setCurrentLimit(effectiveLimit);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        if (lastRequestedKeyRef.current !== requestKey) return;
        const message =
          err instanceof Error ? err.message : "Failed to load candles";
        setError(message);
        if (!isLoadMore) {
          setCandles([]);
        }
      } finally {
        if (lastRequestedKeyRef.current === requestKey) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          isFetchingMoreRef.current = false;
        }
      }
    },
    [activeSymbol, timeframe]
  );

  useEffect(() => {
    void loadCandles();
  }, [loadCandles]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs < 1000) return;

    const id = window.setInterval(() => {
      void loadCandles({ isManualRefresh: true });
    }, autoRefreshMs);

    return () => window.clearInterval(id);
  }, [autoRefreshMs, loadCandles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#cbd5e1",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.06)" },
        horzLines: { color: "rgba(148, 163, 184, 0.06)" },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(148, 163, 184, 0.20)",
          width: 1,
          style: 0,
          labelBackgroundColor: "#111827",
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.20)",
          width: 1,
          style: 0,
          labelBackgroundColor: "#111827",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.14)",
        scaleMargins: {
          top: 0.12,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.14)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: false,
        },
        axisDoubleClickReset: true,
      },
      kineticScroll: {
        mouse: true,
        touch: true,
      },
      localization: {
        priceFormatter: (price: number) => price.toFixed(5),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const maSeries = chart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;

    let lastRange: LogicalRange | null = null;

    const handleVisibleLogicalRangeChange = (range: LogicalRange | null) => {
      if (!range || sameLogicalRange(range, lastRange)) return;
      lastRange = range;

      if (isFetchingMoreRef.current) return;
      if (loading || refreshing || loadingMore) return;
      if (range.from > LOAD_MORE_THRESHOLD_BARS) return;
      if (currentLimitRef.current >= MAX_LIMIT) return;
      if (latestCandlesRef.current.length < currentLimitRef.current - 5) return;

      void loadCandles({
        nextLimit: Math.min(currentLimitRef.current + LOAD_MORE_STEP, MAX_LIMIT),
        preserveRange: range,
        isLoadMore: true,
      });
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: container.clientWidth,
        height,
      });
    });

    resizeObserver.observe(container);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(
        handleVisibleLogicalRangeChange
      );
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      maSeriesRef.current = null;
    };
  }, [height, loadCandles, loading, refreshing, loadingMore]);

  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current || !maSeriesRef.current) return;

    candleSeriesRef.current.setData(candles);
    maSeriesRef.current.setData(buildSma20(candles));

    const chart = chartRef.current;
    const timeScale = chart.timeScale();

    if (preserveRangeRef.current) {
      const priorRange = preserveRangeRef.current;
      const oldVisibleBars = priorRange.to - priorRange.from;
      const prevLengthEstimate = Math.max(0, candles.length - LOAD_MORE_STEP);
      const prependedBars = Math.max(0, candles.length - prevLengthEstimate);

      timeScale.setVisibleLogicalRange({
        from: priorRange.from + prependedBars,
        to: priorRange.from + prependedBars + oldVisibleBars,
      });

      preserveRangeRef.current = null;
    } else if (!initialFitDoneRef.current && candles.length) {
      timeScale.fitContent();
      initialFitDoneRef.current = true;
    }
  }, [candles]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <TrendingUp className="h-5 w-5 text-slate-300" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">{heading}</h3>
                <p className="text-sm text-slate-400">
                  {loading ? "Loading candles..." : `${candles.length} candles loaded`}
                  {loadingMore ? " · Loading more history..." : ""}
                  {lastUpdated ? ` · Updated ${lastUpdated}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                O <span className="text-white">{formatPrice(latest?.open)}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                H <span className="text-white">{formatPrice(latest?.high)}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                L <span className="text-white">{formatPrice(latest?.low)}</span>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                C <span className="text-white">{formatPrice(latest?.close)}</span>
              </div>
              <div
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  changePct !== null && changePct >= 0
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : "border-red-400/20 bg-red-400/10 text-red-300"
                }`}
              >
                {changePct === null
                  ? "-"
                  : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`}
              </div>
              <button
                onClick={() => void loadCandles({ isManualRefresh: true })}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-[220px] flex-1">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Type symbol
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={symbolInput}
                    onChange={(e) => setSymbolInput(normalizeSymbolInput(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyTypedSymbol();
                      }
                    }}
                    placeholder="e.g. EURUSD, XAUUSD, NAS100"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={applyTypedSymbol}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  Load
                </button>
              </div>
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <span className="text-slate-400">Active:</span>{" "}
              <span className="font-medium text-white">{activeSymbol}</span>{" "}
              <span className="text-slate-500">·</span>{" "}
              <span className="font-medium text-white">{timeframe}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-3 pt-3">
        <div
          ref={containerRef}
          className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
          style={{ height }}
        />
      </div>
    </div>
  );
}