import Link from "next/link";
import { ArrowRight, BarChart3, CreditCard } from "lucide-react";

const CARDS = [
  {
    href: "/admin/market-research",
    title: "Market Research",
    description:
      "Build research packs, review COT and price context, create Mon–Wed handovers, and manage Discord digest workflows.",
    icon: BarChart3,
  },
  {
    href: "/admin/billing",
    title: "Billing",
    description:
      "Manage billing-related automation, subscriber workflows, Discord access flows, and payment-linked admin actions.",
    icon: CreditCard,
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CARDS.map(({ href, title, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-white">
              <Icon size={18} />
            </div>

            <ArrowRight
              size={16}
              className="mt-1 text-neutral-500 transition group-hover:translate-x-0.5 group-hover:text-white"
            />
          </div>

          <div className="mt-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              {description}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}