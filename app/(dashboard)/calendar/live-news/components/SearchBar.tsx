// app/(dashboard)/calendar/live-news/components/SearchBar.tsx
"use client";

import { useState } from "react";
import type { NormalizedItem } from "../server/fetchFeeds";

type Props = { onResults: (data: NormalizedItem[]) => void };

export default function SearchBar({ onResults }: Props) {
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // ISO helpers (no date-fns)
  const isoNow = () => new Date().toISOString();
  const isoDaysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  async function handleSearch() {
    if (!query.trim()) {
      onResults([]);
      return;
    }
    setLoading(true);
    try {
      const from = isoDaysAgo(7); // last 7 days default
      const to = isoNow();
      const res = await fetch(
        `/api/news/search?q=${encodeURIComponent(query)}&from=${from}&to=${to}`,
        { headers: { accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as unknown;

      // runtime guard
      const arr = Array.isArray(data) ? (data as NormalizedItem[]) : [];
      onResults(arr);
    } catch (err) {
      console.error("search error", err);
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-5 flex items-center gap-2 px-3">
      <input
        placeholder="Search headlines (e.g., CPI, Powell, rate hike...)"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSearch();
          }
        }}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
        aria-label="Search headlines"
      />
      <button
        type="button"
        onClick={() => void handleSearch()}
        disabled={loading || !query.trim()}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-60"
      >
        {loading ? "Searching..." : "Search"}
      </button>
    </div>
  );
}
