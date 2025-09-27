import { NextRequest, NextResponse } from "next/server";
import { buildFxStrength } from "@/lib/fx/strength";

export const runtime = "nodejs";
export const revalidate = 900; // 15 min

type DayPoint = { date: string; value: number };
// Map: "AUD" | "CAD" | ... -> series of {date,value}
type FxStrengthData = Record<string, DayPoint[]>;

type ApiOk = { ok: true; days: number; data: FxStrengthData };
type ApiErr = { ok: false; error: string };
type ApiResp = ApiOk | ApiErr;

export async function GET(req: NextRequest) {
  try {
    // Prefer NextRequest.nextUrl for robustness
    const sp = req.nextUrl.searchParams;
    const daysParam = sp.get("days");

    let days = 30;
    if (daysParam != null) {
      const parsed = Number(daysParam);
      days = Number.isFinite(parsed) ? parsed : 30;
      days = Math.max(5, Math.min(365, days));
    }

    const range: "3mo" | "6mo" = days > 40 ? "6mo" : "3mo";
    const data = (await buildFxStrength({ days, range })) as FxStrengthData;

    const body: ApiOk = { ok: true, days, data };
    return NextResponse.json<ApiResp>(body, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const body: ApiErr = { ok: false, error: msg };
    return NextResponse.json<ApiResp>(body, { status: 500 });
  }
}
