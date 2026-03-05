import Link from "next/link";
import { CheckCircle2, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Request sent | HaydosFX",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DiscordApplySuccessPage() {
  return (
    <main className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-10">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-300" />
          <h1 className="text-xl font-semibold text-white">Request sent</h1>
        </div>

        <p className="mt-2 text-sm text-slate-300">
          ✅ Thanks — I’ve received your request. Once approved, you’ll be sent access to the free Discord section.
        </p>

        <div className="mt-6">
          <Link
            href="/services"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2",
              "text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to services
          </Link>
        </div>
      </section>
    </main>
  );
}