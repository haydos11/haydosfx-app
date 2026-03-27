// app/(dashboard)/cot/[market]/page.tsx
import { Suspense } from "react";
import MarketPageClient from "./MarketPageClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ market: string }>;
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const { market } = await params;
  const sp = searchParams ? await searchParams : undefined;

  const rawRange = Array.isArray(sp?.range)
    ? sp?.range[0]
    : sp?.range;
  const range = (rawRange ?? "5y").toLowerCase();

  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading…</div>}>
      <MarketPageClient market={market} range={range} />
    </Suspense>
  );
}

// Optional light caching for the tiny server stub
export const revalidate = 300;