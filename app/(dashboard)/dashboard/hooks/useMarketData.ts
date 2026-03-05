"use client";

import { useEffect, useState } from "react";

export type MarketData = {
  vix: number;
  spx: number;
  us10y: number;
  dxy: number;
  gold: number;
  oil: number;
};

export default function useMarketData() {

  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    async function load() {
      try {
        const res = await fetch("/api/market");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Market fetch error", err);
      } finally {
        setLoading(false);
      }
    }

    load();

    const interval = setInterval(load, 60000); // refresh every minute

    return () => clearInterval(interval);

  }, []);

  return { data, loading };
}