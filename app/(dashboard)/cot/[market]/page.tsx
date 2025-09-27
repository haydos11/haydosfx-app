// app/(dashboard)/cot/[market]/page.tsx
import { Suspense } from "react";
import MarketPageClient from "./MarketPageClient";

export default function Page({
  params,
  searchParams,
}: {
  params: { market: string };
  searchParams?: { range?: string | string[] };
}) {
  const market = params.market;
  const rawRange = Array.isArray(searchParams?.range)
    ? searchParams?.range[0]
    : searchParams?.range;
  const range = (rawRange ?? "5y").toLowerCase();

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading…</div>}>
      <MarketPageClient market={market} range={range} />
    </Suspense>
  );
}

// Optional light caching for the tiny server stub
export const revalidate = 300;
