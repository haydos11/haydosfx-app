"use client";
import { useEffect, useState } from "react";

type DebugResp = {
  input: { symbol: string; ymd: string };
  results: {
    v8Primary: number | null;
    altMono: string | null;
    v8AltMono: number | null;
    v7AltMonoSpot: number | null;
    invertedAlt: number | null;
    v7PrimarySpot: number | null;
  };
  chosenUsdPerUnit: number | null;
};

export default function Page() {
  const [data, setData] = useState<DebugResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/yclose?symbol=GBPUSD=X&ymd=2025-09-02", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json: DebugResp = await res.json();
        setData(json);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
      }
    })();
  }, []);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Yahoo Close Test</h1>
      <p>
        Target: <code>GBPUSD=X</code> on <code>2025-09-02</code> (UTC)
      </p>

      {err && <div className="text-red-400">Error: {err}</div>}

      {data && (
        <>
          <div className="rounded-lg border border-white/10 p-4">
            <div className="mb-2 font-medium">Chosen USD per GBP:</div>
            <div className="text-xl">{data.chosenUsdPerUnit ?? "—"}</div>
          </div>

          <pre className="whitespace-pre-wrap rounded-lg border border-white/10 p-4 text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
