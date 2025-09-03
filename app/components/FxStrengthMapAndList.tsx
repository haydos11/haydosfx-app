"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import isoCountries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import type { FeatureCollection, Geometry } from "geojson";

isoCountries.registerLocale(en);

type CountryDatum = { iso2: string; currency: string; strength: number };
type RankRow = { currency: string; z: number };
type Api = {
  updated: string;
  mode: "intraday" | "close";
  index: number;
  labelDate: string | null;
  strengths: Record<string, number>;
  countries: CountryDatum[];
  ranking: RankRow[];
};

/** Minimal typing for the world.json we load */
type WorldFeatureProps = { name?: string; ISO_A2?: string };
type WorldFC = FeatureCollection<Geometry, WorldFeatureProps>;

/** Tooltip param typing (only what we use) */
type MapTipParams = {
  name?: string;
  region?: { properties?: { name?: string } };
  data?: { currency?: string; value?: number };
};

// Names in world.json that don’t match ISO country names
const NAME_TO_ISO_OVERRIDES: Record<string, string> = {
  "United States of America": "US",
  "United States": "US",
  "United Kingdom": "GB",
  "Russian Federation": "RU",
  Russia: "RU",
  "Republic of Korea": "KR",
  Korea: "KR",
  "Democratic People's Republic of Korea": "KP",
  "Lao PDR": "LA",
  "Côte d’Ivoire": "CI",
  "Cote d'Ivoire": "CI",
  "Democratic Republic of the Congo": "CD",
  "Republic of the Congo": "CG",
  Congo: "CG",
  "United Republic of Tanzania": "TZ",
  Tanzania: "TZ",
  "Syrian Arab Republic": "SY",
  Palestine: "PS",
  "Viet Nam": "VN",
  Eswatini: "SZ",
  Swaziland: "SZ",
  "Cabo Verde": "CV",
  "Cape Verde": "CV",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  Türkiye: "TR",
};

function nameToISO2(name?: string): string | undefined {
  if (!name) return undefined;
  return (
    NAME_TO_ISO_OVERRIDES[name] ||
    isoCountries.getAlpha2Code(name, "en") ||
    undefined
  );
}

export default function FXStrengthMapAndList() {
  const [data, setData] = useState<Api | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // NEW: UI state for mode & day index
  const [mode, setMode] = useState<"intraday" | "close">("intraday");
  const [index, setIndex] = useState(0); // D-0

  // Load world map JSON, add ISO_A2 to features, register as "world_iso"
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let res = await fetch("/geo/world.json", { cache: "force-cache" });
        if (!res.ok) {
          res = await fetch(
            "https://echarts.apache.org/examples/data/asset/geo/world.json",
            { cache: "force-cache" }
          );
        }
        if (!res.ok) throw new Error(`world.json ${res.status}`);

        const geo = (await res.json()) as WorldFC;

        if (Array.isArray(geo.features)) {
          geo.features.forEach((f) => {
            if (!f.properties) return;
            const iso2 = nameToISO2(f.properties.name);
            if (iso2) f.properties.ISO_A2 = iso2;
          });
        }

        if (!echarts.getMap("world_iso")) {
          // ECharts’ TS types expect “compressed” GeoJSON; plain GeoJSON works at runtime.
          // This targeted expect-error avoids forcing `any` and keeps types strict elsewhere.
          // @ts-expect-error ECharts accepts plain GeoJSON input here at runtime
          echarts.registerMap("world_iso", { geoJSON: geo });
        }
        if (alive) setMapReady(true);
      } catch (e: unknown) {
        // eslint-disable-next-line no-console
        console.error("Failed to load/register world map", e);
        if (alive) setMapReady(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Fetch API data whenever mode/index change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("mode", mode);
        if (mode === "close") params.set("index", String(index));

        const res = await fetch(`/api/fx-strength?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`API ${res.status}: ${txt}`);
        }
        const json: Api = await res.json();
        if (alive) {
          setData(json);
          setApiError(null);
        }
      } catch (e: unknown) {
        // eslint-disable-next-line no-console
        console.error(e);
        if (alive) setApiError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, index]);

  // Join by ISO2 (we set nameProperty: "ISO_A2" below)
  const seriesData = useMemo(
    () =>
      (data?.countries ?? []).map((c) => ({
        name: c.iso2,
        value: c.strength,
        currency: c.currency,
      })),
    [data]
  );

  const option = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: MapTipParams) => {
          const label = p?.region?.properties?.name ?? p?.name ?? "";
          if (!p?.data) return label;
          const val = p.data.value ?? 0;
          return `
            <div style="min-width:180px">
              <div><strong>${label}</strong></div>
              <div>Currency: ${p.data.currency ?? "-"}</div>
              <div>Strength (z): ${Number(val).toFixed(2)}</div>
            </div>
          `;
        },
      },
      visualMap: {
        left: 10,
        bottom: 10,
        min: -2,
        max: 2,
        text: ["Stronger", "Weaker"],
        calculable: true,
        inRange: {
          // low -> high mapping (red -> neutral-ish -> green)
          color: ["#e60d0dff", "#f87171", "#d3ba15ff", "#34d399", "#08644aff"],
        },
        // countries with no data
        outOfRange: { color: "#e78b1383" },
      },
      series: [
        {
          type: "map",
          map: "world_iso",
          nameProperty: "ISO_A2",
          roam: true,
          itemStyle: { borderColor: "#333" },
          emphasis: { label: { show: false } },
          scaleLimit: { min: 1, max: 10 },
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          data: seriesData,
        },
      ],
    } as echarts.EChartsOption;
  }, [seriesData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* LEFT: Map + toolbar */}
      <div className="lg:col-span-3 rounded-2xl overflow-hidden bg-neutral-900/40 border border-neutral-800">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="text-xl font-semibold">
            Currency Strength ({mode === "intraday" ? "Live" : "Daily Close"})
            {mode === "close" && data?.labelDate ? (
              <span className="ml-2 text-sm text-neutral-400">
                {data.labelDate}
              </span>
            ) : null}
          </h1>

          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1 rounded-full text-sm ${
                mode === "intraday" ? "bg-white/20" : "bg-white/10"
              } hover:bg-white/20`}
              onClick={() => {
                setMode("intraday");
                setIndex(0);
              }}
            >
              Live
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm ${
                mode === "close" ? "bg-white/20" : "bg-white/10"
              } hover:bg-white/20`}
              onClick={() => setMode("close")}
            >
              Daily
            </button>

            {mode === "close" && (
              <div className="ml-2 flex items-center gap-1">
                <button
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                  title="Previous day"
                  onClick={() => setIndex((i) => i + 1)}
                >
                  ←
                </button>
                <button
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
                  title="Next day"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  →
                </button>
                <span className="ml-1 text-xs text-neutral-400">D-{index}</span>
              </div>
            )}
          </div>
        </div>

        {mapReady ? (
          <ReactECharts
            option={option}
            style={{ width: "100%", height: "72vh" }}
          />
        ) : (
          <div className="h-[72vh] grid place-items-center text-neutral-400 text-sm">
            Map not loaded. Ensure <code>/public/geo/world.json</code> exists or
            the remote fetch is allowed.
          </div>
        )}
      </div>

      {/* RIGHT: Ranking sidebar */}
      <aside className="lg:col-span-1 rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Currency Strength (z)</h2>
          <span className="text-xs text-neutral-400">
            {data ? new Date(data.updated).toLocaleTimeString() : ""}
          </span>
        </div>

        {apiError && (
          <div className="mb-2 text-xs text-rose-400">{apiError}</div>
        )}

        <ol className="space-y-1">
          {(data?.ranking ?? []).map((r, i) => (
            <li
              key={r.currency}
              className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-neutral-800/60"
            >
              <span className="text-sm tabular-nums">
                <span className="w-6 inline-block text-neutral-500">
                  {String(i + 1).padStart(2, "0")}
                </span>{" "}
                <strong className="tracking-wide">{r.currency}</strong>
              </span>
              <span
                className={`text-sm tabular-nums ${
                  r.z >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {r.z.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>

        <p className="text-xs text-neutral-500 mt-3">
          {mode === "intraday"
            ? "Live: mean of pair log-returns vs previous close (base +, quote −), z-scored."
            : `Daily D-${index}: mean of pair log-returns close/prev close for that day, z-scored.`}
        </p>
      </aside>
    </div>
  );
}
