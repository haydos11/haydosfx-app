// app/(dashboard)/services/page.tsx
import Link from "next/link";
import {
  ArrowRight,
  CandlestickChart,
  LineChart,
  Users,
  Wrench,
  Sparkles,
  Check,
  Mail,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "Services | HaydosFX",
  description:
    "Live streams, market analysis and private coaching — built around institutional-led narratives and execution.",
};

const LINKS = {
  coachingBooking: "https://buy.stripe.com/4gwbJzfNE0BwfKM5kp",
  premiumSubscribe: "https://buy.stripe.com/bIY4h7gRIbga6acdQX",
  premiumApplication: "https://www.haydosfx.com/application-form-1",
  // ✅ Invite-only Discord request (Typeform / Google Form / your app form)
  discordRequest: "https://discord.gg/TEENQdKuhb",
};

const TAGS = [
  "LIVE TRADING",
  "MARKET ANALYSIS",
  "DISCORD",
  "CUSTOM EA / INDICATORS",
] as const;

const PILLARS = [
  {
    title: "Live Streams",
    icon: CandlestickChart,
    desc:
      "Real-time session coverage with sentiment, news, and price action. Over-the-shoulder decision making — what matters, when it matters.",
  },
  {
    title: "Market Analysis",
    icon: LineChart,
    desc:
      "Top-down planning: session timing, structure, key levels, candlestick context, and news interpretation on targeted assets.",
  },
  {
    title: "Discord Community",
    icon: Users,
    desc:
      "A focused group of traders committed to improving. Education, accountability, and professional support — no noise.",
  },
  {
    title: "Custom Indicators",
    icon: Wrench,
    desc:
      "Proprietary tools + guidance on building an efficient workflow, linking accounts, and improving execution consistency.",
  },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function PillarCard({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm",
        "transition-all hover:bg-white/[0.05] hover:border-white/15 hover:-translate-y-[2px]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-xl border border-white/10 bg-white/[0.04] p-2",
            "transition group-hover:border-indigo-400/30 group-hover:bg-indigo-500/10"
          )}
        >
          <Icon className="h-5 w-5 text-slate-200" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function PriceCard({
  title,
  badge,
  price,
  priceNote,
  blurb,
  bullets,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  featured,
}: {
  title: string;
  badge?: string;
  price: string;
  priceNote?: string;
  blurb: string;
  bullets: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 shadow-sm",
        featured
          ? "border-indigo-400/25 bg-gradient-to-b from-indigo-500/12 via-white/[0.04] to-white/[0.02]"
          : "border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-24 right-[-80px] h-56 w-56 rounded-full blur-3xl",
          featured ? "bg-indigo-500/20" : "bg-white/10"
        )}
      />

      {badge ? (
        <div
          className={cn(
            "absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold",
            featured
              ? "border border-indigo-400/30 bg-indigo-500/15 text-indigo-100"
              : "border border-white/10 bg-white/[0.05] text-slate-200"
          )}
        >
          {badge}
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 grid h-9 w-9 place-items-center rounded-xl border",
            featured
              ? "border-indigo-400/30 bg-indigo-500/15"
              : "border-white/10 bg-white/[0.04]"
          )}
        >
          <Sparkles
            className={cn(
              "h-4 w-4",
              featured ? "text-indigo-100" : "text-slate-200"
            )}
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl font-bold text-white">{price}</div>
            {priceNote ? (
              <div className="text-xs text-slate-400">{priceNote}</div>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-300">{blurb}</p>

      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2 text-sm text-slate-200">
            <span
              className={cn(
                "mt-[3px] grid h-5 w-5 place-items-center rounded-md border",
                featured
                  ? "border-indigo-400/25 bg-indigo-500/10"
                  : "border-white/10 bg-white/[0.03]"
              )}
            >
              <Check className="h-3.5 w-3.5 text-slate-200" />
            </span>
            <span className="text-slate-300">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href={primaryHref}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            featured
              ? "border border-indigo-400/30 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
              : "border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.08]"
          )}
          target="_blank"
          rel="noreferrer"
        >
          {primaryLabel} <ArrowRight className="h-4 w-4" />
        </Link>

        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
            target="_blank"
            rel="noreferrer"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-7 sm:p-10">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-wider text-indigo-200/90">
            SERVICES
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A professional trading workflow — taught live, refined with feedback, and supported by tools.
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Pick the level of support you want — from{" "}
            <span className="text-slate-200">1:1 coaching</span> to the{" "}
            <span className="text-slate-200">Premium membership</span> with streams, analysis,
            Discord, and proprietary indicators.
          </p>

          {/* premium pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="
                  group relative overflow-hidden rounded-full
                  border border-white/10
                  bg-white/[0.04]
                  px-4 py-1.5
                  text-[11px] font-semibold tracking-[0.08em]
                  text-slate-200
                  backdrop-blur-sm
                  transition-all duration-300
                  hover:-translate-y-[2px]
                  hover:border-indigo-400/30
                  hover:bg-indigo-500/10
                  hover:text-white
                "
              >
                <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="absolute -inset-[2px] rounded-full bg-indigo-500/10 blur-md" />
                </span>
                <span className="relative z-10">{tag}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">What you get</h2>
            <p className="mt-1 text-sm text-slate-400">
              Education + support aligned with real session flows and institutional risk transfer.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {PILLARS.map((p) => (
            <PillarCard key={p.title} title={p.title} desc={p.desc} icon={p.icon} />
          ))}
        </div>
      </section>

      {/* Pricing / Offers */}
      <section className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Choose your service</h2>
            <p className="mt-1 text-sm text-slate-400">
              Keep it simple — book a session, or join Premium for the full ecosystem.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <PriceCard
            title="Private 1:1 Coaching (1 hour)"
            badge="Most direct"
            price="$135 AUD"
            priceNote="flat rate • Zoom • recorded"
            blurb="Personalised coaching outside premium trading times. We tighten your process, your execution, and your decision-making."
            bullets={[
              "Personalised feedback on strategy + execution",
              "Bias building, key levels, and session planning",
              "Trade review + psychological edge refinement",
              "Recording sent after the session",
            ]}
            primaryHref={LINKS.coachingBooking}
            primaryLabel="Book 1:1 coaching"
          />

          <PriceCard
            title="Premium Service Subscription"
            badge="Best value"
            price="$110 AUD / month"
            priceNote="tax inclusive"
            blurb="Streams + analysis + community + tools. Built for traders who want consistent structure and accountability."
            bullets={[
              "Real-time streams: sessions, sentiment, and news",
              "Top-down analysis + targeted assets and levels",
              "Discord community support and feedback",
              "Proprietary indicators + workflow guidance",
            ]}
            primaryHref={LINKS.premiumSubscribe}
            primaryLabel="Subscribe to Premium"
            secondaryHref={LINKS.premiumApplication}
            secondaryLabel="Fill application form"
            featured
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Premium onboarding:</span>{" "}
            please complete the application so I understand your background, goals, and current approach.
          </p>
        </div>
      </section>

      {/* ✅ Free Discord (Invite Only) */}
      <section className="mt-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-7 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-slate-200">
                <ShieldCheck className="h-4 w-4 text-indigo-200" />
                FREE DISCORD • INVITE ONLY
              </div>

              <h3 className="mt-3 text-xl font-semibold text-white">
                Join the community (invite-only)
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                You don’t need Premium to apply. Discord access is invite-only to keep the group high quality and avoid spam bots.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={LINKS.discordRequest}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
                target="_blank"
                rel="noreferrer"
              >
                Request Discord Access <Mail className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white">FAQ</h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            {
              q: "Is this signals?",
              a: "This isn’t marketed as a signals product. Levels and trade ideas are shared openly, but the value is the framework — narrative, risk transfer, and execution in live conditions.",
            },
            {
              q: "What markets do you cover?",
              a: "Primarily FX with cross-asset context (rates, USD, risk sentiment). The focus is narrative + liquidity behaviour.",
            },
            {
              q: "Do I need experience?",
              a: "Beginners are welcome, but you’ll get the most value if you’re already placing trades and want structure, discipline, and a clearer process.",
            },
            {
              q: "Do you offer refunds?",
              a: "Coaching is time-based and non-refundable once booked. Premium is monthly — cancel any time before the next billing cycle.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]"
            >
              <h3 className="text-sm font-semibold text-white">{item.q}</h3>
              <p className="mt-2 text-sm text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mt-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-indigo-500/12 to-white/[0.02] p-7 sm:p-10">
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

          <h2 className="text-2xl font-semibold text-white">Ready to level up your process?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            If you want the full ecosystem (streams + analysis + community + tools), Premium is the fastest path.
            If you want a tailored plan and accountability, book a 1:1.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href={LINKS.premiumSubscribe}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/25 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/35"
              target="_blank"
              rel="noreferrer"
            >
              Subscribe to Premium <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={LINKS.coachingBooking}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              target="_blank"
              rel="noreferrer"
            >
              Book 1:1 Coaching
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}