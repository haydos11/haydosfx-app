// lib/economy/types.ts

export type Transform = "none" | "yoy" | "mom" | "diff";
export type Units = "level" | "pct";

export type Point = {
  date: string;
  value: number;
};

export type EconomySeriesOut = {
  id: string;
  label: string;
  units: Units;
  decimals: number;
  latest: number | null;
  latestDate: string | null;
  points: Point[];
};

export type EconomyError = {
  id: string;
  error: string;
};

export type EconomySeriesDef = {
  slug: string;
  label: string;
  units: Units;
  decimals: number;
  preferred?: boolean;
};

export type CalendarIndicatorDef = EconomySeriesDef & {
  exactNames?: string[];
  aliases?: string[];
};

export type CalendarIndicatorSet = Record<string, CalendarIndicatorDef[]>;