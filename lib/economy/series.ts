// lib/economy/series.ts
export type Transform = "none" | "yoy" | "mom" | "diff";
export type Units = "level" | "pct";

export type SeriesDef = {
  /** Stable, de-dupe key for this metric (independent of provider id). */
  slug?: string;
  /** Prefer this source if multiple series share the same slug. */
  preferred?: boolean;
  /** FRED series id (or other provider code if you add more later). */
  id: string;
  /** Shown in UI */
  label: string;
  units?: Units;
  transform?: Transform;
  decimals?: number;
};

export type SeriesSet = Record<string, SeriesDef[]>;

// ---------------- US packs ----------------
export const US_SETS: SeriesSet = {
  core: [
    { slug: "policy_rate",          id: "DFEDTARU",    label: "Interest Rate",                      units: "pct",   transform: "none", decimals: 2, preferred: true },

    // Prices — FRED (levels; compute YoY/MoM via transform)
    { slug: "cpi_yoy",              id: "CPIAUCSL",    label: "CPI (YoY)",                          units: "pct",   transform: "yoy",  decimals: 1, preferred: true },
    { slug: "cpi_mom",              id: "CPIAUCSL",    label: "CPI (MoM)",                          units: "pct",   transform: "mom",  decimals: 2, preferred: true },

{ slug: "ppi_yoy", id: "PPIFID", label: "PPI Final Demand (YoY)", units: "pct", transform: "yoy", decimals: 1, preferred: true }, // NSA for YoY
{ slug: "ppi_mom", id: "PPIFIS", label: "PPI Final Demand (MoM, SA)", units: "pct", transform: "mom", decimals: 2, preferred: true }, // SA for MoM
    // Core PCE — FRED (level; YoY/MoM via transform)
    { slug: "core_pce_yoy",         id: "PCEPILFE",    label: "Core PCE (YoY)",                     units: "pct",   transform: "yoy",  decimals: 2, preferred: true },
    { slug: "core_pce_mom",         id: "PCEPILFE",    label: "Core PCE (MoM)",                     units: "pct",   transform: "mom",  decimals: 2, preferred: true },

    // Labor — Unemployment (level, pct)
    { slug: "unemployment_rate",    id: "UNRATE",      label: "Unemployment Rate",                  units: "pct",   transform: "none", decimals: 2, preferred: true },

    // ✅ NFP as HEADLINE JOBS CREATED: first-difference of PAYEMS (thousands)
{ slug: "payrolls_change", id: "PAYEMS", label: "Nonfarm Payrolls (Change)", units: "level", transform: "diff", decimals: 0, preferred: true },

    // Wages — remove AHE level per request; keep YoY if you still want wage trend
    { slug: "ahe_yoy",              id: "CES0500000003", label: "Avg Hourly Earnings (YoY)",        units: "pct",   transform: "yoy",  decimals: 2, preferred: true },

    // Claims
    { slug: "claims_initial",       id: "ICSA",        label: "Initial Jobless Claims",              units: "level", transform: "none", decimals: 0, preferred: true },
    { slug: "claims_continuing",    id: "CCSA",        label: "Continuing Claims",                   units: "level", transform: "none", decimals: 0, preferred: true },

    // Growth & activity
    { slug: "real_gdp_yoy",         id: "GDPC1",       label: "Real GDP (YoY)",                      units: "pct",   transform: "yoy",  decimals: 2, preferred: true },
    { slug: "indprod_yoy",          id: "INDPRO",      label: "Industrial Production (YoY)",         units: "pct",   transform: "yoy",  decimals: 2, preferred: true },

    // Retail sales — both nominal & real MoM views available
    { slug: "retail_nominal_mom",   id: "TOTALSA",     label: "Retail Sales (Nominal, MoM)",         units: "pct",   transform: "mom",  decimals: 2, preferred: true },
    { slug: "retail_real_mom",      id: "RRSFS",       label: "Retail Sales (Real, MoM)",            units: "pct",   transform: "mom",  decimals: 2, preferred: true },

    // Surveys
    { slug: "umich_sentiment",      id: "UMCSENT",     label: "Consumer Sentiment",                   units: "level", transform: "none", decimals: 2, preferred: true },
    { slug: "ism_manufacturing",    id: "NAPM",        label: "ISM Manufacturing PMI",                units: "level", transform: "none", decimals: 2, preferred: true },
    { slug: "ism_services",         id: "NAPMNMI",     label: "ISM Services PMI (NMI)",               units: "level", transform: "none", decimals: 2, preferred: true },
  ],

  prices: [
    { slug: "cpi_index_lvl",        id: "CPIAUCSL",    label: "CPI Index (Lvl)",                     units: "level", transform: "none", decimals: 2 },
    { slug: "pce_yoy",              id: "PCEPI",       label: "PCE (YoY)",                           units: "pct",   transform: "yoy",  decimals: 2 },
    { slug: "core_pce_yoy",         id: "PCEPILFE",    label: "Core PCE (YoY)",                      units: "pct",   transform: "yoy",  decimals: 2 },
    { slug: "ppi_yoy",              id: "PPIACO",      label: "PPI (YoY)",                           units: "pct",   transform: "yoy",  decimals: 2 },
    { slug: "cpi_mom",              id: "CPIAUCSL",    label: "CPI (MoM)",                           units: "pct",   transform: "mom",  decimals: 2 },
    { slug: "ppi_mom",              id: "PPIACO",      label: "PPI (MoM)",                           units: "pct",   transform: "mom",  decimals: 2 },
  ],

  growth: [
    { slug: "real_gdp_yoy",         id: "GDPC1",       label: "Real GDP (YoY)",                      units: "pct",   transform: "yoy",  decimals: 2 },
    { slug: "indprod_yoy",          id: "INDPRO",      label: "Industrial Production (YoY)",         units: "pct",   transform: "yoy",  decimals: 2 },
    { slug: "capacity_util",        id: "TCU",         label: "Capacity Utilization",                 units: "level", transform: "none", decimals: 2 },
    { slug: "retail_nominal_mom",   id: "TOTALSA",     label: "Retail Sales (Nominal, MoM)",         units: "pct",   transform: "mom",  decimals: 2 },
  ],

  housing: [
    { slug: "housing_starts",       id: "HOUST",       label: "Housing Starts",                       units: "level", transform: "none", decimals: 0 },
    { slug: "building_permits",     id: "PERMIT",      label: "Building Permits",                     units: "level", transform: "none", decimals: 0 },
    { slug: "median_home_price",    id: "MSPUS",       label: "Median Home Price",                    units: "level", transform: "none", decimals: 0 },
    { slug: "case_shiller_yoy",     id: "CSUSHPISA",   label: "Case-Shiller (YoY)",                   units: "pct",   transform: "yoy",  decimals: 2 },
  ],

  markets: [
    { slug: "ust2y",                id: "DGS2",        label: "2Y Treasury",                          units: "pct",   transform: "none", decimals: 2 },
    { slug: "ust10y",               id: "DGS10",       label: "10Y Treasury",                         units: "pct",   transform: "none", decimals: 2 },
  ],

  trade: [
    { slug: "exports_saar_bn",      id: "EXPGS",       label: "Exports (SAAR, $bn)",                  units: "level", transform: "none", decimals: 1 },
    { slug: "imports_saar_bn",      id: "IMPGS",       label: "Imports (SAAR, $bn)",                  units: "level", transform: "none", decimals: 1 },
    { slug: "net_exports_saar_bn",  id: "NETEXP",      label: "Net Exports (SAAR, $bn)",              units: "level", transform: "none", decimals: 1 },
  ],
};

// ---------------- Global packs ----------------
export const GLOBAL_SETS: SeriesSet = {
  inflation: [
    { slug: "us_cpi_oecd_yoy",  id: "CPALTT01USM657N", label: "United States (YoY CPI)", units: "pct", transform: "none", decimals: 2 },
    { slug: "uk_cpi_yoy",       id: "GBRCPIALLMINMEI", label: "United Kingdom",          units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "ca_cpi_yoy",       id: "CANCPALLMINMEI",  label: "Canada",                  units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "jp_cpi_yoy",       id: "JPNCPIALLMINMEI", label: "Japan",                   units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "de_cpi_yoy",       id: "DEUCPIALLMINMEI", label: "Germany",                 units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "fr_cpi_yoy",       id: "FRACPIALLMINMEI", label: "France",                  units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "it_cpi_yoy",       id: "ITACPIALLMINMEI", label: "Italy",                   units: "pct", transform: "yoy",  decimals: 2 },
  ],
  compare: [
    { slug: "us_unemployment",  id: "UNRATE",          label: "US Unemployment", units: "pct", transform: "none", decimals: 2 },
    { slug: "us_real_gdp_yoy",  id: "GDPC1",           label: "US Real GDP YoY", units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "uk_cpi_yoy",       id: "GBRCPIALLMINMEI", label: "UK CPI YoY",      units: "pct", transform: "yoy",  decimals: 2 },
    { slug: "ea_cpi_yoy",       id: "EA19CPIALLMINMEI",label: "Euro Area CPI YoY", units: "pct", transform: "yoy", decimals: 2 },
  ],
};

export const COUNTRY_SETS: Record<string, SeriesSet> = {
  us: US_SETS,
  global: GLOBAL_SETS,
};
