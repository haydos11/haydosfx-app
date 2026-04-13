"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, Home } from "lucide-react";

const ITEMS = [
  {
    href: "/admin",
    label: "Overview",
    icon: Home,
    match: (pathname: string) => pathname === "/admin",
  },
  {
    href: "/admin/market-research",
    label: "Market Research",
    icon: BarChart3,
    match: (pathname: string) =>
      pathname === "/admin/market-research" ||
      pathname.startsWith("/admin/market-research/"),
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: CreditCard,
    match: (pathname: string) =>
      pathname === "/admin/billing" || pathname.startsWith("/admin/billing/"),
  },
];

export default function AdminSubnav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);

          return (
            <Link
              key={href}
              href={href}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors whitespace-nowrap",
                active
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
              ].join(" ")}
            >
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}