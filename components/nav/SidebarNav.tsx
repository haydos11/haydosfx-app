// app/(dashboard)/components/nav/SidebarNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/currency-strength", label: "Currencies" },
  { href: "/cot",               label: "COT Report" },
  { href: "/economy",           label: "Economy" },
  { href: "/calendar",          label: "Calendar" },
];

// Sub-sections shown only when inside that area
const ECON_SUB = [
  { href: "/economy/us",      label: "United States" },
  { href: "/economy/compare", label: "Compare" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  const WIDTH      = "w-full";
  const ITEM_SPACE = "space-y-3.5";
  const ITEM_PAD   = "px-4 py-3";
  const OUTLINE    = "border border-white/10";
  const HOVER      = "hover:bg-white/[0.05] hover:border-white/20 hover:text-white";
  const ACTIVE     = "bg-white/[0.06] border-white/25 text-white";

  const isActiveMain = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const inEconomy = pathname.startsWith("/economy");
  const economySubpage = inEconomy && pathname !== "/economy";

  return (
    <aside className={`${WIDTH} shrink-0 border-r border-white/10 bg-[#0b0b0b] overflow-hidden`}>
      <div className="px-5 pt-6 pb-5">
        <div className="text-3xl font-semibold tracking-tight">HAYDOSFX</div>
      </div>

      <nav className="px-3 pb-8">
        {/* Main items */}
        <ul className={ITEM_SPACE}>
          {MAIN.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={[
                  "block rounded-xl transition-colors",
                  OUTLINE, ITEM_PAD, HOVER,
                  isActiveMain(href) ? ACTIVE : "text-slate-300",
                ].join(" ")}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Economy subnav */}
        {inEconomy && (
          <>
            <div className="mx-1 my-6 border-t border-white/10" />
            <div className="px-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Economy
            </div>

            <ul className="mt-2 space-y-1.5">
              {economySubpage && (
                <li>
                  <Link
                    href="/economy"
                    className="block rounded-lg px-4 py-2 text-slate-300 hover:text-white hover:bg-white/[0.05]"
                  >
                    ← Back to Economy
                  </Link>
                </li>
              )}
              {ECON_SUB.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={[
                        "block rounded-lg px-4 py-2 text-sm transition-colors",
                        active
                          ? "bg-white/[0.06] text-white"
                          : "text-slate-300 hover:text-white hover:bg-white/[0.05]",
                      ].join(" ")}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>
    </aside>
  );
}
