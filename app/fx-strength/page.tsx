"use client";

import dynamic from "next/dynamic";
import FXStrengthHistory from "../components/FXStrengthHistory";

// match the exact casing/path of your component file
const FxStrengthMapAndList = dynamic(
  () => import("../components/FxStrengthMapAndList"),
  { ssr: false }
);

export default function FxStrengthPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Currency Strength (Yahoo)</h1>

      <FxStrengthMapAndList />

      {/* ✅ ADD THIS LINE to show the 30/60-day history chart */}
      <FXStrengthHistory />
    </main>
  );
}
