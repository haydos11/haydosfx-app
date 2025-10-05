// app/(dashboard)/currencies/page.tsx
import FxChartPanel from "./components/FxChartPanel";

export default function Page() {
  return (
    <div className="space-y-4">
      <FxChartPanel />
    </div>
  );
}
