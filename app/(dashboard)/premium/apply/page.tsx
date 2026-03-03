import React from "react";
import { submitApplication } from "./actions";

export const metadata = {
  title: "Premium Application | HaydosFX",
  description:
    "Apply to join Premium. A focused environment built around institutional-led narratives, execution, and accountability.",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Field(props: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const { label, name, required, hint, children } = props;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={name} className="text-sm font-semibold text-slate-100">
          {label} {required ? <span className="text-indigo-200">*</span> : null}
        </label>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

const inputBase = [
  "w-full rounded-2xl border border-white/10 bg-white/[0.05]",
  "px-5 py-4 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm",
  "outline-none transition",
  "focus:border-indigo-400/40 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/20",
].join(" ");

function StepPill({
  n,
  title,
  desc,
}: {
  n: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/10 text-xs font-bold text-indigo-100">
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <main className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-14 lg:px-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-44 h-72 w-72 rounded-full bg-indigo-500/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-40 bottom-6 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-10">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-wider text-indigo-200/90">
            PREMIUM APPLICATION
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">
            Apply to join HaydosFX Premium
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-300">
            This keeps the community high-quality and lets me tailor your onboarding.
            Give me context — I’ll give you structure.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StepPill n="1" title="Apply" desc="Your background + goals." />
          <StepPill n="2" title="Subscribe" desc="Choose Premium plan." />
          <StepPill n="3" title="Login" desc="Create / sign in." />
          <StepPill n="4" title="Access" desc="Invite + tools within 24h." />
        </div>
      </section>

      {/* Form */}
      <section className="mt-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">
              Your details
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              The more honest and detailed you are, the better your onboarding will be.
            </p>
          </div>

          <form action={submitApplication} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Name" name="name" required>
                <input
                  id="name"
                  name="name"
                  required
                  className={inputBase}
                  placeholder="Your name"
                />
              </Field>

              <Field label="Email" name="email" required>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={inputBase}
                  placeholder="you@email.com"
                />
              </Field>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field
                label="Discord username"
                name="discord_alias"
                hint="If you have one"
              >
                <input
                  id="discord_alias"
                  name="discord_alias"
                  className={inputBase}
                  placeholder="e.g. haydosfx"
                />
              </Field>

              <Field
                label="TradingView username"
                name="tradingview_name"
                hint="If you publish ideas"
              >
                <input
                  id="tradingview_name"
                  name="tradingview_name"
                  className={inputBase}
                  placeholder="e.g. haydosfx"
                />
              </Field>
            </div>

            <Field
              label="Tell me about your trading experience"
              name="experience"
              required
            >
              <textarea
                id="experience"
                name="experience"
                required
                rows={6}
                className={cn(inputBase, "min-h-[160px] resize-y")}
                placeholder="How long have you traded? What markets? Biggest struggle? What causes you to lose consistency?"
              />
            </Field>

            <Field
              label="Are you a member of other trading groups?"
              name="other_groups"
              required
            >
              <textarea
                id="other_groups"
                name="other_groups"
                required
                rows={4}
                className={cn(inputBase, "min-h-[120px] resize-y")}
                placeholder="Yes/No + which ones (optional)"
              />
            </Field>

            <Field
              label="Anything else you want me to know?"
              name="additional_info"
            >
              <textarea
                id="additional_info"
                name="additional_info"
                rows={6}
                className={cn(inputBase, "min-h-[160px] resize-y")}
                placeholder="What does success look like for you in 90 days?"
              />
            </Field>

            <div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/20 px-6 py-4 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30 hover:border-indigo-300/40"
              >
                Submit application →
              </button>

              <p className="mt-4 text-xs text-slate-400">
                This is not a signals product. The focus is decision-making,
                narrative understanding, and disciplined execution.
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}