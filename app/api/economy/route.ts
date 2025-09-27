import { NextRequest, NextResponse } from "next/server";
import { COUNTRY_SETS } from "@/lib/economy/series";
import { fetchFredSeries, type FredPoint } from "@/lib/economy/fred";
import { transformSeries } from "@/lib/economy/transforms";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Infer the transform parameter type from transformSeries (no need to export a type)
type TransformParam = Parameters<typeof transformSeries>[1];

type Def = {
  id: string;
  label: string;
  units?: "level" | "pct";
  decimals?: number;
  transform?: TransformParam;
};

type SeriesOut = {
  id: string;
  label: string;
  units: "level" | "pct";
  decimals: number;
  latest: number | null;
  latestDate: string | null;
  points: FredPoint[];
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "us").toLowerCase();
  const setName = searchParams.get("set") || "core";
  const start = searchParams.get("start") || "1990-01-01";
  const end = searchParams.get("end") || new Date().toISOString().slice(0, 10);

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

  // Tolerant fetch: skip failures, collect errors
  const results = await Promise.allSettled(
    defs.map(async (def): Promise<SeriesOut> => {
      const raw = await fetchFredSeries(def.id, start, end, apiKey);
      const data = transformSeries(raw, def.transform);
      const latest = data[data.length - 1] ?? null;

      return {
        id: def.id,
        label: def.label,
        units: def.units ?? "level",
        decimals: def.decimals ?? 2,
        latest: latest?.value ?? null,
        latestDate: latest?.date ?? null,
        points: data,
      };
    })
  );

  const series: SeriesOut[] = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : []
  );

  const errors = results.flatMap((r, idx) =>
    r.status === "rejected" ? [{ id: defs[idx].id, error: String(r.reason) }] : []
  );

  if (series.length === 0) {
    return NextResponse.json(
      { error: "All series failed", errors, meta: { country, set: setName, start, end } },
      { status: 502 }
    );
  }

  return NextResponse.json({ series, errors, meta: { country, set: setName, start, end } });
}
