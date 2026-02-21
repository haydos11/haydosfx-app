// app/(dashboard)/dev-calendar/page.tsx
"use client";

import * as React from "react";
import AppShell from "@/components/shell/AppShell";
import AnalyzeButton, { type AnalyzeResponse } from "../calendar/components/AnalyzeButton";

/* ---------------------------------- helpers ---------------------------------- */
// Numbers like: 1,234.5 | 2.1% | 645.47B | -0.3 | 7M
const numberFromToken = (raw: string): number | null => {
  const s = (raw || "")
    .replace(/\u00A0/g, " ") // NBSP → space
    .trim()
    .replace(/[–—−]/g, "-"); // normalize dashes

  if (!s || s === "-" || s === "—") return null;

  const pct = /%$/.test(s);
  const cleaned = s.replace(/,/g, "").replace(/%$/, "");

  const m = cleaned.match(/^([+-]?\d+(?:\.\d+)?)([KMBT])?$/i);

  let val: number;
  if (m) {
    const base = Number(m[1]);
    const suffix = (m[2] || "").toUpperCase();
    const map: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    const mult: number = map[suffix] ?? 1; // <-- always a number (fixes TS2363)
    val = base * mult;
  } else {
    val = Number(cleaned);
  }

  if (!Number.isFinite(val)) return null;
  return pct ? val / 100 : val;
};

const toISOForTodayAtUTC = (timeHHmm?: string): string => {
  if (!timeHHmm || !/^\d{1,2}:\d{2}$/.test(timeHHmm)) return new Date().toISOString();
  const [hh, mm] = timeHHmm.split(":").map(Number);
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm));
  return d.toISOString();
};

// Currency -> country code your analyzer expects
const CCY_TO_COUNTRY: Record<string, string> = {
  USD: "US", EUR: "EU", GBP: "GB", JPY: "JP", CNY: "CN", AUD: "AU", NZD: "NZ",
  CAD: "CA", CHF: "CH", SEK: "SE", NOK: "NO", DKK: "DK", MXN: "MX", ZAR: "ZA",
  INR: "IN", RUB: "RU", BRL: "BR", TRY: "TR", KRW: "KR", HKD: "HK", SGD: "SG",
};

// Robust one-liner parser.
// Expected order: time · currency · indicator · actual · forecast · previous
// Handles tabs, NBSPs, multi-spaces, %, and K/M/B/T suffixes.
function parseLineToFields(lineRaw: string) {
  const line = lineRaw
    .replace(/\u00A0/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!line) {
    return { time: "", ccy: "", indicator: "", actualStr: "", forecastStr: "", previousStr: "", unit: "" };
  }

  // Pull ALL numeric-ish tokens, take the LAST up to 3 (actual/forecast/previous)
  const numRe = /[+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|[+-]?\d+(?:\.\d+)?%?|[+-]?\d+(?:\.\d+)?[KMBT]/gi;
  const allNums = [...line.matchAll(numRe)].map(m => ({
    text: m[0],
    start: m.index as number,
    end: (m.index as number) + m[0].length,
  }));
  const lastThree = allNums.slice(-3);

  let actualStr = "", forecastStr = "", previousStr = "";
  if (lastThree.length) {
    const tokens = lastThree.map(t => t.text);
    [actualStr, forecastStr, previousStr] = [tokens[0] || "", tokens[1] || "", tokens[2] || ""];
  }

  // Remove trailing numeric chunk to get the "head"
  let head = line;
  if (lastThree.length) {
    const cutAt = lastThree[0].start; // first of the last-three
    head = line.slice(0, cutAt).trim();
  }

  // From head: time + currency + indicator
  const headTokens = head.split(" ").filter(Boolean);
  let time = "", ccy = "", indicator = "";
  if (headTokens.length >= 2) {
    if (/^\d{1,2}:\d{2}$/.test(headTokens[0]) || /^All$/i.test(headTokens[0])) {
      if (/^All$/i.test(headTokens[0]) && /^Day$/i.test(headTokens[1])) {
        time = "All Day";
        ccy = (headTokens[2] || "").toUpperCase();
        indicator = headTokens.slice(3).join(" ");
      } else {
        time = headTokens[0];
        ccy = (headTokens[1] || "").toUpperCase();
        indicator = headTokens.slice(2).join(" ");
      }
    } else {
      // sometimes time is missing -> first token is currency
      ccy = (headTokens[0] || "").toUpperCase();
      indicator = headTokens.slice(1).join(" ");
    }
  } else {
    indicator = headTokens.join(" ");
  }

  const unit = /%/.test(`${actualStr} ${forecastStr} ${previousStr}`) ? "%" : "";
  return { time, ccy, indicator: indicator.trim(), actualStr, forecastStr, previousStr, unit };
}

/* ----------------------------- brief generator ----------------------------- */
function pickPairs(country: string) {
  switch (country) {
    case "GB": return ["GBPUSD", "EURGBP", "GBPJPY", "FTSE 100", "UK Gilts"];
    case "US": return ["EURUSD", "GBPUSD", "USDJPY", "S&P 500", "UST 2y/10y"];
    case "EU": return ["EURUSD", "EURGBP", "EURJPY", "EuroStoxx 50", "Bunds"];
    case "JP": return ["USDJPY", "EURJPY", "GBPJPY", "Nikkei 225", "JGBs"];
    case "CN": return ["USDCNH", "AUDUSD", "NZDUSD", "Copper", "CSI 300"];
    default:    return ["USD Index (DXY)", "Gold", "S&P 500", "Crude"];
  }
}
function surpriseLabel(actual: number | null, forecast: number | null, previous: number | null) {
  if (actual == null && forecast == null) return "No actual reported yet.";
  if (actual == null) return "Awaiting the actual print.";
  const f = forecast ?? previous;
  if (f == null) return "Actual reported; no reference consensus available.";
  const delta = actual - f;
  const updown = delta > 0 ? "above" : delta < 0 ? "below" : "in line with";
  const pct = f !== 0 ? ` (${Math.abs((delta / Math.abs(f)) * 100).toFixed(2)}%)` : "";
  return `Actual came ${updown} expectations${pct}.`;
}
function biasHint(indicator: string, unit: string | null, actual: number | null, forecast: number | null) {
  const name = (indicator || "").toLowerCase();
  const upIsHawkish = /(earnings|wage|cpi|inflation|average weekly|pay|jobs|nfp|employment|unemployment)/i.test(name) && unit === "%";
  if (actual == null) return "No directional bias until the actual is known.";
  const f = forecast ?? 0;
  const up = actual > f;
  if (upIsHawkish) return up ? "Hawkish tilt (higher-than-expected)." : "Dovish tilt (softer-than-expected).";
  return up ? "Stronger-than-expected reading." : "Softer-than-expected reading.";
}
function sessionTips(timeIso: string, country: string) {
  const d = new Date(timeIso);
  const hh = d.getUTCHours();
  const isLondon = country === "GB" || country === "EU";
  const tips = [
    "5–15 min after release: fade/continuation decision point.",
    "Top-of-hour and :30 marks: liquidity pockets; watch for second impulse.",
    "London–NY overlap (12:00–16:00 UTC): trend extensions more likely.",
  ];
  if (isLondon && hh >= 6 && hh <= 10) tips.unshift("London open (07:00–09:00 UTC): volatility elevated.");
  return tips;
}
function formatNum(n: number | null, unit: string | null) {
  if (n == null) return "N/A";
  const suffix = unit === "%" ? "%" : "";
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + "T" + suffix;
  if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(2)  + "B" + suffix;
  if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(2)  + "M" + suffix;
  if (Math.abs(n) >= 1e3)  return (n / 1e3).toFixed(2)  + "K" + suffix;
  return n.toFixed(2) + suffix;
}
function buildStructuredBrief(ev: {
  country: string | null;
  indicator: string | null;
  unit: string | null;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  releasedAt: string;
}) {
  const c = ev.country ?? "Unknown";
  const indicator = ev.indicator ?? "Unknown indicator";
  const pairs = pickPairs(c);
  const surpris = surpriseLabel(ev.actual, ev.forecast, ev.previous);
  const bias = biasHint(indicator, ev.unit, ev.actual, ev.forecast);
  const schedule = sessionTips(ev.releasedAt, c);

  return [
    `### What it is`,
    `This is **${indicator}** for **${c}**.`,
    ``,
    `### Latest numbers`,
    `- Actual: **${formatNum(ev.actual, ev.unit)}**`,
    `- Forecast (consensus): **${formatNum(ev.forecast, ev.unit)}**`,
    `- Previous: **${formatNum(ev.previous, ev.unit)}**`,
    `- ${surpris} ${bias}`,
    ``,
    `### Why it matters`,
    `- Shifts **macro rates & currency expectations** for ${c}.`,
    `- Can affect local risk appetite (equities) and bonds.`,
    ``,
    `### Likely FX impact & instruments to watch`,
    `- Focus pairs: **${pairs.join(", ")}**.`,
    `- Stronger-than-expected → ${c} tends to **firm**; softer → tends to **soften**.`,
    ``,
    `### Price action game plan`,
    `- Into release: spreads widen; pre-positioning can unwind.`,
    `- First impulse: wait 30–90s; avoid chasing first wick.`,
    `- Continuation or fade: watch prior H/L, session HOD/LOD, VWAP devs.`,
    `- Risk control: use prior minute’s range for initial stops.`,
    ``,
    `### Timing windows`,
    ...schedule.map((s) => `- ${s}`),
  ].join("\n");
}

/* ---------------------------------- page ---------------------------------- */
export default function DevCalendarPage(): React.ReactElement {
  const [height, setHeight] = React.useState(700);
  const [contentWidth, setContentWidth] = React.useState(940);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [mode, setMode] = React.useState<"paste" | "form">("paste");
  const [forceFresh, setForceFresh] = React.useState(false);
  const [brief, setBrief] = React.useState<string>("");

  // Investing.com UK widget
  const embedUrl =
    "https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&features=datepicker,timezone&countries=25,34,32,6,37,72,71,22,17,51,39,14,33,10,35,43,60,38,36,110,11,26,9,12,4,5&calType=week&timeZone=15&lang=51";

  // Analyze state
  type AnalyzeForm = {
    country: string;
    indicator: string;
    unit: string;
    actual: string;
    forecast: string;
    previous: string;
    releasedAt: string;
  };
  const [, setAiByRun] = React.useState<Record<string, AnalyzeResponse>>({});
  const [form, setForm] = React.useState<AnalyzeForm>({
    country: "",
    indicator: "",
    unit: "",
    actual: "",
    forecast: "",
    previous: "",
    releasedAt: new Date().toISOString(),
  });
  const setField = <K extends keyof AnalyzeForm>(k: K, v: AnalyzeForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [pasteLine, setPasteLine] = React.useState("");

  function handleParsePaste() {
    const { time, ccy, indicator, actualStr, forecastStr, previousStr, unit } =
      parseLineToFields(pasteLine);

    const country = (CCY_TO_COUNTRY[ccy] ?? ccy) || "";
    let releasedAt = toISOForTodayAtUTC(time);
    if (forceFresh) releasedAt = new Date(new Date(releasedAt).getTime() + 1000).toISOString();

    setForm({
      country,
      indicator,
      unit,
      actual: actualStr,
      forecast: forecastStr,
      previous: previousStr,
      releasedAt,
    });
    setMode("form"); // let user review before generating/analyzing
  }

  // Derive the event from either paste (preferred while in paste mode) or form
  function buildEventFromInputs() {
    if (mode === "paste" && pasteLine.trim()) {
      const { time, ccy, indicator, actualStr, forecastStr, previousStr, unit } =
        parseLineToFields(pasteLine);
      const country = (CCY_TO_COUNTRY[ccy] ?? ccy) || null; // TS5076-safe
      let releasedAt = toISOForTodayAtUTC(time);
      if (forceFresh) releasedAt = new Date(new Date(releasedAt).getTime() + 1000).toISOString();
      return {
        country,
        indicator: indicator || null,
        unit: unit || null,
        actual: numberFromToken(actualStr),
        forecast: numberFromToken(forecastStr),
        previous: numberFromToken(previousStr),
        revised: null as number | null,
        releasedAt,
      };
    }
    // fallback: use form
    return {
      country: form.country || null,
      indicator: form.indicator || null,
      unit: form.unit || null,
      actual: numberFromToken(form.actual),
      forecast: numberFromToken(form.forecast),
      previous: numberFromToken(form.previous),
      revised: null as number | null,
      releasedAt: form.releasedAt || new Date().toISOString(),
    };
  }

  function handleBuildBrief() {
    const ev = buildEventFromInputs();
    setBrief(buildStructuredBrief(ev));
  }

  // keep this available for the Analyze button too
  const calendarEvent = buildEventFromInputs();

  return (
    <AppShell
      fullBleed
      container="full"
      className="pt-2"
      title="Dev Calendar — Investing.com UK Widget"
      subtitle={
        <span className="text-slate-400">
          Paste a row → auto-parse → generate a structured explainer or run Analyze. Iframe is centered to match the widget’s fixed width.
        </span>
      }
      right={
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          {panelOpen ? "Hide" : "Show"} Quick Analyze
        </button>
      }
    >
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3 px-3 text-xs text-slate-300">
        <label className="flex items-center gap-2">
          Height:
          <input
            type="range"
            min={400}
            max={1200}
            step={10}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-40"
          />
          <span>{height}px</span>
        </label>
        <label className="flex items-center gap-2">
          Content width:
          <input
            type="range"
            min={720}
            max={1280}
            step={10}
            value={contentWidth}
            onChange={(e) => setContentWidth(Number(e.target.value))}
            className="w-40"
          />
          <span>{contentWidth}px</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={forceFresh}
            onChange={(e) => setForceFresh(e.target.checked)}
          />
          Force fresh (bust cache)
        </label>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]"
        >
          Open in new tab
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Widget card */}
        <div className={panelOpen ? "md:col-span-8" : "md:col-span-12"}>
          <div className="overflow-hidden rounded-3xl border border-white/10 ring-1 ring-white/5 bg-[#0b0b0b]/70 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500/30 via-fuchsia-500/30 to-emerald-500/30" />
            <div className="px-2 md:px-3 py-2">
              <div className="mx-auto" style={{ width: contentWidth }}>
                <iframe
                  src={embedUrl}
                  style={{ height, width: contentWidth, border: 0, backgroundColor: "transparent" }}
                  className="block"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>

          {/* attribution (required by Investing.com TOS) */}
          <div className="mt-3 text-center text-[11px] text-slate-400">
            Real-Time Economic Calendar provided by{" "}
            <a
              href="https://uk.investing.com/"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="text-indigo-400 hover:underline"
            >
              Investing.com UK
            </a>
            .
          </div>
        </div>

        {/* Quick Analyze + Structured Brief panel */}
        {panelOpen && (
          <aside className="md:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              {/* Toggle */}
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => setMode("paste")}
                  className={`rounded-md px-3 py-1.5 text-xs ${mode === "paste" ? "bg-white/15 text-white" : "border border-white/10 text-slate-200 hover:bg-white/[0.06]"}`}
                >
                  Simple paste
                </button>
                <button
                  onClick={() => setMode("form")}
                  className={`rounded-md px-3 py-1.5 text-xs ${mode === "form" ? "bg-white/15 text-white" : "border border-white/10 text-slate-200 hover:bg-white/[0.06]"}`}
                >
                  Full form
                </button>
              </div>

              {mode === "paste" ? (
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Paste a row (time, currency, event, actual, estimated, previous)
                  </label>
                  <textarea
                    rows={2}
                    value={pasteLine}
                    onChange={(e) => setPasteLine(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/30 p-2 text-xs text-slate-200"
                    placeholder='e.g. 11:10  GBP  Average Weekly Earnings + Bonus (Aug)  5.0%  4.7%  4.8%'
                  />
                  {/* Optional: quick parsed preview so you know what will feed the brief */}
                  {pasteLine.trim() && (() => {
                    const { time, ccy, indicator, actualStr, forecastStr, previousStr } = parseLineToFields(pasteLine);
                    return (
                      <div className="mt-2 text-[11px] text-slate-400">
                        Parsed → <span className="text-slate-300">{time || "—"}</span> · <span className="text-slate-300">{ccy || "—"}</span> · <span className="text-slate-300">{indicator || "—"}</span> · A:<span className="text-slate-300">{actualStr || "—"}</span> F:<span className="text-slate-300">{forecastStr || "—"}</span> P:<span className="text-slate-300">{previousStr || "—"}</span>
                      </div>
                    );
                  })()}
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={handleParsePaste}
                      className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
                      title="Parse into fields so you can review, then Analyze"
                    >
                      Parse → Fill form
                    </button>
                    <span className="text-[11px] text-slate-400">Understands %, K/M/B/T, commas</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Country" value={form.country} onChange={(v) => setField("country", v)} placeholder="GB, US, EU…" />
                  <Field label="Unit" value={form.unit} onChange={(v) => setField("unit", v)} placeholder="% / USD / pts" />
                  <div className="col-span-2">
                    <Field label="Indicator" value={form.indicator} onChange={(v) => setField("indicator", v)} placeholder="CPI (YoY), NFP, PMI…" />
                  </div>
                  <Field label="Actual" value={form.actual} onChange={(v) => setField("actual", v)} placeholder="5.0%" />
                  <Field label="Estimated / Forecast" value={form.forecast} onChange={(v) => setField("forecast", v)} placeholder="4.7%" />
                  <Field label="Previous" value={form.previous} onChange={(v) => setField("previous", v)} placeholder="4.8%" />
                  <Field label="Released At (ISO)" value={form.releasedAt} onChange={(v) => setField("releasedAt", v)} placeholder="2025-10-16T10:00:00Z" />
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AnalyzeButton
                  compact
                  triggerClassName="!h-8 !w-8 !p-0"
                  calendarEvent={{
                    country: calendarEvent.country,
                    indicator: calendarEvent.indicator,
                    unit: calendarEvent.unit,
                    actual: calendarEvent.actual,
                    forecast: calendarEvent.forecast,
                    previous: calendarEvent.previous,
                    revised: null,
                    releasedAt: calendarEvent.releasedAt,
                  }}
                  onResult={(res) => setAiByRun((prev) => ({ ...prev, [String(Date.now())]: res }))}
                />
                <button
                  onClick={handleBuildBrief}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]"
                >
                  Generate Structured Brief
                </button>
              </div>

              {brief && (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {brief}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}

/* --------------------------- tiny input component --------------------------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/15"
      />
    </label>
  );
}
