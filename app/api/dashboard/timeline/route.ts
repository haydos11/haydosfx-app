import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsItem = {
  id: string;
  time: string; // "HH:MM" London
  title: string;
  country: string | null;
  impact: "medium" | "high";
};

function getLondonYMD(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

function londonDayBoundsUTC() {
  const ymd = getLondonYMD();

  // Use "now" to anchor in the current year/day (safe around DST)
  const anchor = new Date();

  const startLondon = new Date(`${ymd}T00:00:00`);
  const endLondon = new Date(`${ymd}T24:00:00`);

  const toLondonInstant = (dt: Date) =>
    new Date(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(
        // keep day from dt but using anchor's year context
        new Date(
          anchor.getFullYear(),
          anchor.getMonth(),
          anchor.getDate(),
          dt.getHours(),
          dt.getMinutes(),
          dt.getSeconds()
        )
      )
    );

  const s = toLondonInstant(startLondon);
  const e = toLondonInstant(endLondon);

  return { ymd, startISO: s.toISOString(), endISO: e.toISOString() };
}

function londonHHMMFromISO(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

function normalizeImpact(r: any): "medium" | "high" | null {
  const candidates = [
    r.impact,
    r.importance,
    r.importance_name,
    r.importance_label,
    r.importance_id,
    r.impact_id,
  ];

  for (const x of candidates) {
    if (typeof x === "string") {
      const v = x.trim().toLowerCase();
      if (v.includes("high")) return "high";
      if (v.includes("med")) return "medium";
      if (v === "3") return "high";
      if (v === "2") return "medium";
    }
    if (typeof x === "number") {
      if (x >= 3) return "high";
      if (x === 2) return "medium";
    }
  }
  return null;
}

function pickTitle(r: any) {
  return (
    r.title ??
    r.name ??
    r.event_name ??
    r.event ??
    r.indicator ??
    r.release ??
    "Event"
  );
}

function pickCountry(r: any) {
  return r.country ?? r.currency ?? r.ccy ?? r.region ?? null;
}

function pickTimeISO(r: any): string | null {
  return (
    r.ts ??
    r.datetime ??
    r.time_utc ??
    r.release_time ??
    r.released_at ??
    r.event_time ??
    null
  );
}

// ✅ IMPORTANT: accept client as any to avoid Supabase generic mismatch in your repo
async function tryTable(
  supabase: any,
  table: string,
  timeCol: string,
  startISO: string,
  endISO: string
) {
  const q = await supabase
    .from(table)
    .select("*")
    .gte(timeCol, startISO)
    .lt(timeCol, endISO)
    .limit(250);

  if (q.error) throw new Error(`${table}.${timeCol}: ${q.error.message}`);
  return (q.data as any[]) ?? [];
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { ymd, startISO, endISO } = londonDayBoundsUTC();

    const sources = [
      { table: "calendar_values_human", timeCols: ["ts", "datetime", "time_utc"] },
      { table: "calendar_values", timeCols: ["ts", "datetime", "time_utc"] },
      { table: "calendar_events", timeCols: ["ts", "datetime", "time_utc"] },
    ];

    let rows: any[] = [];
    let used: string | null = null;

    outer: for (const s of sources) {
      for (const c of s.timeCols) {
        try {
          rows = await tryTable(supabase as any, s.table, c, startISO, endISO);
          used = `${s.table}.${c}`;
          break outer;
        } catch {
          // try next
        }
      }
    }

    if (!used) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not find a usable table/time column for today. Tried calendar_values_human/calendar_values/calendar_events with ts/datetime/time_utc",
        },
        { status: 500 }
      );
    }

    const items: NewsItem[] = rows
      .map((r) => {
        const iso = pickTimeISO(r);
        const impact = normalizeImpact(r);
        if (!iso || !impact) return null;

        return {
          id: String(r.id ?? r.event_id ?? `${pickTitle(r)}-${iso}`),
          time: londonHHMMFromISO(String(iso)),
          title: String(pickTitle(r)),
          country: pickCountry(r) ? String(pickCountry(r)) : null,
          impact,
        } satisfies NewsItem;
      })
      .filter(Boolean) as NewsItem[];

    const filtered = items
      .filter((x) => x.impact === "high" || x.impact === "medium")
      .sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json(
      { ok: true, date: ymd, used, items: filtered },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}