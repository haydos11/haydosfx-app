// app/(dashboard)/cot/page.tsx
import CotPageClient from "./CotPageClient";

type SearchParams = Promise<{ range?: string | string[] }>;

export default async function CotPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range = (raw ?? "1y").toLowerCase();

  return <CotPageClient range={range} />;
}