"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type CSSProperties } from "react";
import type { EChartsOption } from "echarts";

// Narrow typing of echarts-for-react to just what we use.
const ReactECharts = dynamic(
  () => import("echarts-for-react"),
  { ssr: false }
) as unknown as React.ComponentType<{
  option: EChartsOption;
  style?: CSSProperties;
  className?: string;
  notMerge?: boolean;
  replaceMerge?: string[]; // ECharts 5 setOption replaceMerge
  lazyUpdate?: boolean;
}>;

export type SafeEChartProps = {
  option: EChartsOption;
  height?: number | string;
  className?: string;

  /** forwarded to echarts setOption */
  notMerge?: boolean;
  replaceMerge?: string[];
  lazyUpdate?: boolean;
};

export default function SafeEChart({
  option,
  height = 140,
  className,
  notMerge,
  replaceMerge,
  lazyUpdate,
}: SafeEChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div style={{ height }} />; // keep layout stable during SSR

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      className={className}
      notMerge={notMerge}
      replaceMerge={replaceMerge}
      lazyUpdate={lazyUpdate}
    />
  );
}
