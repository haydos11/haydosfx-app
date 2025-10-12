// app/page.tsx
import Link from "next/link";
import SidebarNav from "@/components/nav/SidebarNav";

export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-black text-slate-200">
      {/* Sidebar */}
      <SidebarNav />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-10">
        <h1 className="text-3xl font-semibold">Welcome</h1>
        <p className="mt-3 text-slate-400">
          Pick a section on the left to get started, or jump to{" "}
          <Link className="underline hover:text-white" href="/currency-strength">
            Currency Strength
          </Link>.
        </p>
      </main>
    </div>
  );
}
