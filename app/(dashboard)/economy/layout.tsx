import AppShell from "@/components/shell/AppShell";
import BackToEconomyLink from "@/components/nav/BackToEconomyLink";

export default function EconomyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      // Title block with the back link on subpages (client) and the heading
      title={
        <div className="flex flex-col gap-2">
          <BackToEconomyLink />
          <span className="text-xl font-semibold sm:text-2xl">Economy</span>
        </div>
      }
      subtitle="Macro dashboards, yields, & ROC modules."
      container="full"  // header full width
      fullBleed         // body full width
    >
      {children}
    </AppShell>
  );
}
