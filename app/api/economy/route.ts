// app/api/economy/route.ts

import { NextRequest, NextResponse } from "next/server";
import { COUNTRY_SETS } from "@/lib/economy/series";
import { fetchFredSeries } from "@/lib/economy/fred";
import { transformSeries } from "@/lib/economy/transforms";
import { getUkCalendarSeries } from "@/lib/economy/uk/calendar";
import { getAuCalendarSeries } from "@/lib/economy/au/calendar";
import { getEuCalendarSeries } from "@/lib/economy/eu/calendar";
import { getJpCalendarSeries } from "@/lib/economy/jp/calendar";
import { getCaCalendarSeries } from "@/lib/economy/ca/calendar";
import { getChCalendarSeries } from "@/lib/economy/ch/calendar";
import { getNzCalendarSeries } from "@/lib/economy/nz/calendar";
import type { EconomySeriesOut } from "@/lib/economy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransformParam = Parameters<typeof transformSeries>[1];

type Def = {
  slug?: string;
  id: string;
  label: string;
  units?: "level" | "pct";
  decimals?: number;
  transform?: TransformParam;
};

async function handleCalendarCountry(
  country: string,
  setName: string,
  start: string,
  end: string
): Promise<NextResponse | null> {
  try {
    if (country === "gb" || country === "uk") {
      const { series, errors } = await getUkCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All UK calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    if (country === "au") {
      const { series, errors } = await getAuCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All AU calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    if (country === "eu") {
      const { series, errors } = await getEuCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All EU calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    if (country === "jp") {
      const { series, errors } = await getJpCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All JP calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    if (country === "ca") {
      const { series, errors } = await getCaCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All CA calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    if (country === "ch" || country === "chf") {
      const { series, errors } = await getChCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All CH calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    if (country === "nz" || country === "nzd") {
      const { series, errors } = await getNzCalendarSeries({ start, setName });

      if (series.length === 0) {
        return NextResponse.json(
          {
            error: "All NZ calendar series failed",
            errors,
            meta: { country, set: setName, start, end, source: "calendar" },
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        series,
        errors,
        meta: { country, set: setName, start, end, source: "calendar" },
      });
    }

    return null;
  } catch (err) {
    const label =
      country === "gb" || country === "uk"
        ? "UK"
        : country.toUpperCase();

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : `${label} calendar fetch failed`,
        meta: { country, set: setName, start, end, source: "calendar" },
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "us").toLowerCase();
  const setName = searchParams.get("set") || "core";
  const start = searchParams.get("start") || "1990-01-01";
  const end = searchParams.get("end") || new Date().toISOString().slice(0, 10);

  const calendarResponse = await handleCalendarCountry(country, setName, start, end);
  if (calendarResponse) return calendarResponse;

  const sets = COUNTRY_SETS[country as keyof typeof COUNTRY_SETS];
  if (!sets) {
    return NextResponse.json({ error: `Unknown country: ${country}` }, { status: 400 });
  }

  const defs = sets[setName as keyof typeof sets] as unknown as Def[] | undefined;
  if (!defs) {
    return NextResponse.json({ error: `Unknown set: ${setName}` }, { status: 400 });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing FRED_API_KEY" }, { status: 500 });
  }

  const results = await Promise.allSettled(
    defs.map(async (def): Promise<EconomySeriesOut> => {
      const raw = await fetchFredSeries(def.id, start, end, apiKey);
      const data = transformSeries(raw, def.transform);
      const latest = data[data.length - 1] ?? null;

      return {
        id: def.slug ?? def.id,
        label: def.label,
        units: def.units ?? "level",
        decimals: def.decimals ?? 2,
        latest: latest?.value ?? null,
        latestDate: latest?.date ?? null,
        points: data,
      };
    })
  );

  const series: EconomySeriesOut[] = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : []
  );

  const errors = results.flatMap((r, idx) =>
    r.status === "rejected"
      ? [{ id: defs[idx].slug ?? defs[idx].id, error: String(r.reason) }]
      : []
  );

  if (series.length === 0) {
    return NextResponse.json(
      {
        error: "All series failed",
        errors,
        meta: { country, set: setName, start, end, source: "fred" },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    series,
    errors,
    meta: { country, set: setName, start, end, source: "fred" },
  });
}