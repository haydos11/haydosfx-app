"use client";

import { useEffect, useMemo, useState } from "react";

type DayPoint = { date: string; value: number };
type FxStrengthData = Record<string, DayPoint[]>;

type ApiOk = {
  ok: true;
  days: number;
  data: FxStrengthData;
};

type ApiErr = {
  ok: false;
  error: string;
};

type ApiResp = ApiOk | ApiErr;

type CurrencyPoint = {
  code: string;
  strength: number;
};

function getBg(strength: number) {
  if (strength >= 2) return "bg-green-600";
  if (strength >= 1) return "bg-green-500/70";

  if (strength <= -2) return "bg-red-600";
  if (strength <= -1) return "bg-red-500/70";

  return "bg-zinc-700";
}

function formatSigned(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v > 0 ? "+" : ""; // negatives already include "-"
  return `${sign}${v.toFixed(2)}`;
}

export default function CurrencyHeatmap() {
  const [rows, setRows] = useState<CurrencyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/fx-strength?days=30", {
          cache: "no-store",
        });

        const json: ApiResp = await res.json();

        if (!res.ok) {
          setError(`Request failed (${res.status})`);
          return;
        }

        if (!json.ok) {
          setError(json.error || "FX strength error");
          return;
        }

        const points: CurrencyPoint[] = Object.entries(json.data).map(
          ([code, series]) => {
            // pick the most recent numeric value
            let strength = 0;
            for (let i = series.length - 1; i >= 0; i--) {
              const v = series[i]?.value;
              if (typeof v === "number" && Number.isFinite(v)) {
                strength = v;
                break;
              }
            }
            return { code, strength };
          }
        );

        if (alive) setRows(points);
      } catch (e) {
        if (alive) setError("FX strength fetch failed");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b.strength - a.strength);
  }, [rows]);

  if (loading) {
    return (
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-lg font-semibold mb-4">Currency Strength</h2>
        <div className="text-sm text-slate-400">Loading FX strength…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 p-4 rounded-xl">
        <h2 className="text-lg font-semibold mb-4">Currency Strength</h2>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">Currency Strength</h2>
        <span className="text-[11px] text-white/45">
          Daily close model
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {sorted.map((c, idx) => (
          <div
            key={c.code}
            className={`rounded-lg p-2 ${getBg(c.strength)}`}
            title={`${c.code}: ${formatSigned(c.strength)}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">
                {c.code}
              </div>
              <div className="text-[10px] opacity-80">
                #{idx + 1}
              </div>
            </div>

            <div className="mt-1 text-xs font-medium">
              {formatSigned(c.strength)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-white/45">
        Sorted strongest → weakest (last available value)
      </div>
    </div>
  );
}