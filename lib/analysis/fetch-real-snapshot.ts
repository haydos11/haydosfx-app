import type { SnapshotRouteResponse, SnapshotRouteRow } from "./types";

export async function fetchRealSnapshotRows(origin: string): Promise<{
  asOfDate: string;
  updated: string;
  rows: SnapshotRouteRow[];
}> {
  const adminToken = process.env.ANALYSIS_ADMIN_TOKEN;

  const res = await fetch(`${origin}/api/cot/test-snapshot`, {
    method: "GET",
    cache: "no-store",
    headers: adminToken
      ? {
          "x-analysis-token": adminToken,
        }
      : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Snapshot fetch failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as SnapshotRouteResponse;

  if (!json?.rows || !Array.isArray(json.rows) || json.rows.length === 0) {
    throw new Error("No snapshot rows returned from /api/cot/test-snapshot");
  }

  return {
    asOfDate: json.date ?? new Date().toISOString().slice(0, 10),
    updated: json.updated,
    rows: json.rows,
  };
}