import AppShell from "@/components/shell/AppShell";

export default function CotLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      title="COT Report"
      subtitle="Futures positioning • CFTC Commitments of Traders"
      stickyHeader
      fullBleed
      container="full"
      className="bg-[#0b0b0b]" 
    >
      {/* remove max-w constraint so the body can span full width */}
      <div className="w-full px-4 lg:px-6 pt-2 pb-6">
        {children}
      </div>
    </AppShell>
  );
}
