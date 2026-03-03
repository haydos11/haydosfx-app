// app/premium/apply/success/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Application Received | HaydosFX",
  description: "Your Premium application has been received.",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function SuccessPage() {
  return (
    <main className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-7 sm:p-10">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

        <p className="text-xs font-semibold tracking-wider text-indigo-200/90">
          SUBMITTED
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Application received ✅
        </h1>

        <p className="mt-4 text-base leading-relaxed text-slate-300">
          Thanks — I’ve got it. Next step is subscription (if you haven’t already),
          then I’ll sort access and send your Discord invite.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <ol className="space-y-3 text-sm text-slate-300">
            {[
              "Subscribe to Premium (monthly).",
              "Create / login to your website account (so I can grant permissions).",
              "Discord invite + tools access + Premium unlock within 24 hours.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400/60" />
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/services"
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
              "border border-indigo-400/30 bg-indigo-500/20 text-indigo-100",
              "hover:bg-indigo-500/30 hover:border-indigo-300/40"
            )}
          >
            Go to services → subscribe
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Back to home
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          If you subscribed already, you’re done — access will be granted shortly.
        </p>
      </section>
    </main>
  );
}