import AppShell from "@/components/shell/AppShell";
import Link from "next/link";

export default function Page() {
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Welcome</h1>
      <p className="mt-3 text-slate-400">
        Pick a section on the left to get started, or jump to{" "}
        <Link className="underline hover:text-white" href="/currency-strength">
          Currency Strength
        </Link>.
      </p>
    </AppShell>
  );
}
