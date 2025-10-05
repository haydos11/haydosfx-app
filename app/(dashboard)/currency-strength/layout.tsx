// app/(dashboard)/currency-strength/layout.tsx
import AppShell from "@/components/shell/AppShell";

export default function CurrencyStrengthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      title="Currency Strength"
      subtitle="Equal-weighted G8 indices from daily closes"
      stickyHeader
      fullBleed
      container="full"
      className="bg-[#0b0b0b]" 
    >
      <div className="w-full px-4 lg:px-6 pt-2 pb-6">
        {children}
      </div>
    </AppShell>
  );
}
