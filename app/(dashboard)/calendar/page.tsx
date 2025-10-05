// app/(dashboard)/calendar/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import AppShell from "@/components/shell/AppShell";
import CalendarClient from "./CalendarClient";

export default function Page() {
  return (
    <AppShell
      title="Economic Calendar"
      subtitle
      stickyHeader
      fullBleed
      container="full"  // <-- makes the AppShell header span the full viewport (like Economy)
      className="bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(99,102,241,0.12),transparent),radial-gradient(1000px_520px_at_80%_-10%,rgba(16,185,129,0.10),transparent)]"
    >
      <CalendarClient />
    </AppShell>
  );
}
