import AppShell from "@/components/shell/AppShell";

export default function CurrenciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      title="Currency Charts"
      subtitle
      stickyHeader
      fullBleed
      container="full"
      className="bg-[#0b0b0b]" // consistent with other pages, no colour gradient
    >
      <div className="w-full px-4 lg:px-6 py-0">
        {children}
      </div>
    </AppShell>
  );
}
