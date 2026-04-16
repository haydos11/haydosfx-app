"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Home,
  LineChart,
  Waves,
} from "lucide-react";
import clsx from "clsx";

const items = [
  {
    href: "/admin",
    label: "Overview",
    icon: Home,
  },
  {
    href: "/admin/market-research",
    label: "Market Research",
    icon: BarChart3,
  },
  {
    href: "/admin/sentiment-lab",
    label: "Sentiment Lab",
    icon: Waves,
  },
  {
    href: "/admin/cot-digest",
    label: "COT Digest",
    icon: ClipboardList,
  },
  {
    href: "/test-cot",
    label: "Test COT",
    icon: LineChart,
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: CreditCard,
  },
];

export default function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}