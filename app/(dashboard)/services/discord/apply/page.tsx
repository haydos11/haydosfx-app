import Link from "next/link";
import { ArrowLeft, ShieldCheck, Mail } from "lucide-react";
import { submitDiscordAccessRequest } from "./action";

export const metadata = {
  title: "Request Discord Access | HaydosFX",
  description: "Invite-only access request for the free Discord section to reduce spam.",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DiscordApplyPage() {
  return (
    <main className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="mb-6">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to services
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-7 sm:p-10">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-slate-200">
          <ShieldCheck className="h-4 w-4 text-indigo-200" />
          FREE DISCORD • INVITE ONLY
        </div>

        <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Request Discord Access</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          To keep the community high quality (and block spam bots), access is approved manually.
          Fill this out and you’ll be approved shortly.
        </p>

        <form action={submitDiscordAccessRequest} className="mt-7 space-y-4">
          {/* Honeypot */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-200">Name</label>
              <input
                name="name"
                required
                placeholder="Your name"
                className={cn(
                  "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white",
                  "outline-none placeholder:text-slate-500 focus:border-indigo-400/30 focus:bg-white/[0.06]"
                )}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-200">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@email.com"
                className={cn(
                  "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white",
                  "outline-none placeholder:text-slate-500 focus:border-indigo-400/30 focus:bg-white/[0.06]"
                )}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Discord username</label>
            <input
              name="discord_username"
              required
              placeholder="e.g. haydosfx (or old name#1234)"
              className={cn(
                "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white",
                "outline-none placeholder:text-slate-500 focus:border-indigo-400/30 focus:bg-white/[0.06]"
              )}
            />
            <p className="mt-1 text-xs text-slate-400">
              Make sure it matches your Discord profile exactly so I can find you.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Message (optional)</label>
            <textarea
              name="message"
              placeholder="Where did you find me / what markets do you trade?"
              className={cn(
                "mt-1 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white",
                "outline-none placeholder:text-slate-500 focus:border-indigo-400/30 focus:bg-white/[0.06]"
              )}
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
          >
            Join the Free Discord <Mail className="h-4 w-4" />
          </button>

          <p className="text-xs text-slate-400">
            Heads up: this is for the free community section. Premium members have separate onboarding.
          </p>
        </form>
      </section>
    </main>
  );
}