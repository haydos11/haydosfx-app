"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import isoCountries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import type { FeatureCollection, Geometry } from "geojson";

isoCountries.registerLocale(en);

type CountryDatum = { iso2: string; currency: string; strength: number | null };
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

type WorldFeatureProps = { name?: string; ISO_A2?: string };
type WorldFC = FeatureCollection<Geometry, WorldFeatureProps>;

/** Colors */
const COLOR_NOT_MEASURED = "#0f172a"; // very dark slate (not in universe)
const COLOR_NO_DATA_TODAY = "#1f2937"; // medium slate (in universe, null)

/** Name overrides / normalization */
const NAME_TO_ISO_OVERRIDES: Record<string, string> = {
  "United States of America": "US",
  "United States": "US",
  "United Kingdom": "GB",
  "Russian Federation": "RU",
  Russia: "RU",
  "Republic of Korea": "KR",
  Korea: "KR",
  "Democratic People's Republic of Korea": "KP",
  "Côte d’Ivoire": "CI",
  "Cote d'Ivoire": "CI",
  "Ivory Coast": "CI",
  "Democratic Republic of the Congo": "CD",
  "Congo (Kinshasa)": "CD",
  "Republic of the Congo": "CG",
  "Congo (Brazzaville)": "CG",
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
  "W. Sahara": "EH",
  "Western Sahara": "EH",
  "S. Sudan": "SS",
  "South Sudan": "SS",
  Somaliland: "SO",
};

function normalizeName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/^\s*The\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function nameToISO2(name?: string): string | undefined {
  if (!name) return undefined;
  if (NAME_TO_ISO_OVERRIDES[name]) return NAME_TO_ISO_OVERRIDES[name];
  const raw = isoCountries.getAlpha2Code(name, "en");
  if (raw) return raw;
  const norm = normalizeName(name);
  if (NAME_TO_ISO_OVERRIDES[norm]) return NAME_TO_ISO_OVERRIDES[norm];
  return isoCountries.getAlpha2Code(norm, "en") || undefined;
}

/** Static country → currency universe (keep aligned with server) */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  GB: "GBP",
  CH: "CHF",
  NO: "NOK",
  SE: "SEK",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CN: "CNH", // China = offshore CNH
  HK: "HKD",
  SG: "SGD",
  ZA: "ZAR",
};

const canonCCY = (ccy: string) => (ccy === "CNY" ? "CNH" : ccy);


export default function FXStrengthMapAndList() {
  const [data, setData] = useState<Api | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [mode, setMode] = useState<"intraday" | "close">("intraday");
  const [index, setIndex] = useState(0);

  // Load & register map (always re-register so ISO_A2 is present)
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

        geo.features?.forEach((f) => {
          if (!f.properties) return;
          const iso2 = nameToISO2(f.properties.name);
          if (iso2) f.properties.ISO_A2 = iso2;
        });

        // @ts-expect-error ECharts accepts plain GeoJSON here
        echarts.registerMap("world_iso", { geoJSON: geo });

        if (alive) setMapReady(true);
      } catch {
        if (alive) setMapReady(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Fetch API
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
        if (alive) setApiError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, index]);

  /** Build series in one pass: strengths baseline, then override with countries[] */
  const seriesData = useMemo(() => {
    // start with full measured universe set to null (no data today)
    const rows = Object.entries(COUNTRY_CURRENCY).map(([iso, ccy]) => ({
      name: iso,
      value: null as number | null,
      currency: ccy,
    }));
    const idx = new Map(rows.map((d, i) => [d.name, i]));

    // baseline from currency strengths
    const s = data?.strengths ?? {};
    for (const [iso, ccy] of Object.entries(COUNTRY_CURRENCY)) {
      const z = s[ccy as keyof typeof s];
      if (typeof z === "number" && Number.isFinite(z)) {
        rows[idx.get(iso)!].value = z;
      }
    }

    // per-country overrides
    for (const c of data?.countries ?? []) {
      if (!COUNTRY_CURRENCY[c.iso2]) continue; // only measured universe
      const i = idx.get(c.iso2);
      if (i != null) {
        rows[i].value = c.strength; // can be null
        rows[i].currency = c.currency || rows[i].currency;
      }
    }

    return rows;
  }, [data]);

  /** For tooltip: which ISO2s are measured (in our series) */
  const measuredSet = useMemo(
    () => new Set(seriesData.map((d) => d.name)),
    [seriesData]
  );

  /** Tooltip — use any to dodge overly strict ECharts TS generics */
  const tooltipFormatter = (p: any) => {
    const human = p?.region?.properties?.name ?? "";
    const iso = p?.name ?? "";

    if (!measuredSet.has(iso)) {
      return `${human || iso}<br/><span style="opacity:.7">Not measured (includes unknown)</span>`;
    }

    const v = p?.data?.value;
    if (v == null) {
      return `${human || iso}<br/><span style="opacity:.7">No data today</span>`;
    }

    const ccy = p?.data?.currency ?? "";
    return `
      <div style="min-width:180px">
        <div><strong>${human || iso}</strong></div>
        <div>Currency: ${ccy || "-"}</div>
        <div>Strength (z): ${Number(v).toFixed(2)}</div>
      </div>
    `;
  };

  const option = useMemo<echarts.EChartsOption>(() => {
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: tooltipFormatter as any,
      },
      visualMap: {
        type: "piecewise",
        seriesIndex: 0, // single series
        left: 10,
        bottom: 10,
        orient: "vertical",
        text: ["Stronger", "Weaker"],
        itemWidth: 14,
        itemHeight: 10,
        textGap: 6,
        pieces: [
          { lte: -1.5, color: "#7f1d1d" },
          { gt: -1.5, lte: -1.0, color: "#b91c1c" },
          { gt: -1.0, lte: -0.5, color: "#ef4444" },
          { gt: -0.5, lt: -0.05, color: "#fca5a5" },
          { gte: -0.05, lte: 0.05, color: "#ffffff" }, // tight neutral
          { gt: 0.05, lte: 0.49, color: "#bbf7d0" },
          { gt: 0.49, lte: 0.99, color: "#86efac" },
          { gt: 0.99, lte: 1.49, color: "#22c55e" },
          { gt: 1.49, color: "#14532d" },
        ],
        outOfRange: { color: COLOR_NO_DATA_TODAY }, // value === null
      },
      series: [
        {
          type: "map",
          map: "world_iso",
          nameProperty: "ISO_A2",
          roam: true,
          itemStyle: { borderColor: "#333", areaColor: COLOR_NOT_MEASURED },
          emphasis: { label: { show: false } },
          scaleLimit: { min: 1, max: 10 },
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          data: seriesData, // measured only; non-measured use areaColor
        } as echarts.MapSeriesOption,
      ],
    } as echarts.EChartsOption;
  }, [seriesData, tooltipFormatter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* LEFT: Map + toolbar */}
      <div className="lg:col-span-3 rounded-2xl overflow-hidden bg-neutral-900/40 border border-neutral-800">
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="text-xl font-semibold">
            Currency Strength ({data?.mode === "intraday" ? "Live" : "Daily Close"})
            {data?.mode === "close" && data?.labelDate ? (
              <span className="ml-2 text-sm text-neutral-400">{data.labelDate}</span>
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
          <ReactECharts option={option} notMerge style={{ width: "100%", height: "72vh" }} />
        ) : (
          <div className="h-[72vh] grid place-items-center text-neutral-400 text-sm">
            Map not loaded. Ensure <code>/public/geo/world.json</code> exists or the remote fetch is allowed.
          </div>
        )}
      </div>

      {/* RIGHT: Ranking + legend */}
      <aside className="lg:col-span-1 rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Currency Strength (z)</h2>
          <span className="text-xs text-neutral-400">
            {data ? new Date(data.updated).toLocaleTimeString() : ""}
          </span>
        </div>

        {apiError && <div className="mb-2 text-xs text-rose-400">{apiError}</div>}

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
              <span className={`text-sm tabular-nums ${r.z >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {r.z.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-4 space-y-1 text-xs text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_NO_DATA_TODAY }} />
            <span>No data today</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_NOT_MEASURED }} />
            <span>Not measured (includes unknown)</span>
          </div>
        </div>

        <p className="text-xs text-neutral-500 mt-3">
          {mode === "intraday"
            ? "Live: mean of pair log-returns vs previous close (base +, quote −), z-scored."
            : `Daily D-${index}: mean of pair log-returns close/prev close for that day, z-scored.`}
        </p>
      </aside>
    </div>
  );
}
