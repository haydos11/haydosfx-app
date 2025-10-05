// app/(dashboard)/cot/page.tsx
import CotPageClient from "./CotPageClient";

type SearchParams = { range?: string | string[] };

export default function CotPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = Array.isArray(searchParams.range) ? searchParams.range[0] : searchParams.range;
  const range = (raw ?? "1y").toLowerCase();

  // ✅ No extra <header> — AppShell already provides the page title/subtitle
  return <CotPageClient range={range} />;
}
