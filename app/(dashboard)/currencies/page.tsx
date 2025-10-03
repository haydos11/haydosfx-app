// app/(dashboard)/currencies/page.tsx
import AppShell from "@/components/shell/AppShell";
import FxChartPanel from "./components/FxChartPanel";

export default function Page() {
  return (
    <AppShell fullBleed container="full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">Currency Charts</h1>
          <a href="/currency-strength" className="text-xs text-slate-400 hover:text-slate-200 underline">
            Go to Currency Strength →
          </a>
        </div>
        <FxChartPanel />
      </div>
    </AppShell>
  );
}
