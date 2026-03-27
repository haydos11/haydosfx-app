import { Suspense } from "react";
import AppShell from "@/components/shell/AppShell";
import TestMarketPageClient from "./TestMarketPageClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ market: string }>;
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const { market } = await params;
  const sp = searchParams ? await searchParams : undefined;

  const rawRange = Array.isArray(sp?.range) ? sp?.range[0] : sp?.range;
  const range = (rawRange ?? "5y").toLowerCase();

  return (
    <AppShell
      title="Test COT Market"
      subtitle="Supabase-backed individual market view"
      stickyHeader
      fullBleed
      container="full"
      className="bg-[#0b0b0b]"
    >
      <div className="w-full px-4 lg:px-6 pt-2 pb-6">
        <Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading…</div>}>
          <TestMarketPageClient market={market} range={range} />
        </Suspense>
      </div>
    </AppShell>
  );
}

export const revalidate = 300;