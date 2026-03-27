import AppShell from "@/components/shell/AppShell";
import TestCotPageClient from "./TestCotPageClient";

export default function TestCotPage() {
  return (
    <AppShell
      title="Test COT"
      subtitle="Supabase-backed COT snapshot and FX strength test page"
      stickyHeader
      fullBleed
      container="full"
      className="bg-[#0b0b0b]"
    >
      <div className="w-full px-4 lg:px-6 pt-2 pb-6">
        <TestCotPageClient />
      </div>
    </AppShell>
  );
}