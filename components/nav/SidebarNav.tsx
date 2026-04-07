// components/nav/SidebarNav.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  GitCompare,
  ChevronLeft,
  Menu,
  ArrowLeft,
  Zap,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { Icon as Iconify } from "@iconify/react";

/* ---- main nav (emoji) ---- */
const MAIN = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

  { href: "/currency-strength", label: "Currency Strength", emoji: "💪" },
  { href: "/partners", label: "Partners", emoji: "🤝" },
  { href: "/services", label: "Services", emoji: "💼" },
  //{ href: "/currencies", label: "Currency Charts", emoji: "💱" },
  { href: "/cot", label: "COT Reports", emoji: "📊" },
  { href: "/economy", label: "Economy", emoji: "🌍" },
  { href: "/calendar", label: "Calendar", emoji: "🗓️" },
];

/* ---- Learn item ---- */
const LEARN = {
  href: "/learn",
  label: "Learn",
  emoji: "🎓",
  sub: "Core Foundations",
};

/* ---- Admin item ---- */
const ADMIN = {
  href: "/admin/cot-digest",
  label: "Admin",
  icon: Shield,
};

/* ---- sub-nav: Calendar (Lucide) ---- */
const CAL_SUB = [
  { href: "/calendar", label: "Events", Icon: CalendarDays },
  { href: "/calendar/live-news", label: "Live News", Icon: Zap },
];

/* ---- sub-nav: Economy ---- */
const ECON_SUB = [
  { href: "/economy/us", label: "United States", flag: "circle-flags:us" },
  { href: "/economy/uk", label: "United Kingdom", flag: "circle-flags:gb" },
  { href: "/economy/eu", label: "Eurozone", flag: "circle-flags:eu" },
  { href: "/economy/jp", label: "Japan", flag: "circle-flags:jp" },
  { href: "/economy/ca", label: "Canada", flag: "circle-flags:ca" },
  { href: "/economy/ch", label: "Switzerland", flag: "circle-flags:ch" },
  { href: "/economy/au", label: "Australia", flag: "circle-flags:au" },
  { href: "/economy/nz", label: "New Zealand", flag: "circle-flags:nz" },
  { href: "/economy/compare", label: "Compare", iconOnly: true },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("sidebar:collapsed");
    if (v) setCollapsed(v === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const WIDTH = collapsed ? "w-16" : "w-56";
  const ITEM_SPACE = "space-y-1.5";
  const ITEM_PAD = collapsed ? "px-0 py-2" : "px-3.5 py-2.5";
  const ACTIVE = "text-white font-medium";
  const INACTIVE = "text-slate-300 hover:text-white";

  const isActiveMain = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const inEconomy = pathname.startsWith("/economy");
  const economySubpage = inEconomy && pathname !== "/economy";

  const inCalendar = pathname.startsWith("/calendar");
  const calendarSubpage = inCalendar && pathname !== "/calendar";

  const liveNewsActive = pathname === "/calendar/live-news";
  const pulseClass = liveNewsActive ? "animate-pulse" : "";

  const inLearn =
    pathname === LEARN.href || pathname.startsWith(LEARN.href + "/");

  const inAdmin =
    pathname === ADMIN.href || pathname.startsWith(ADMIN.href + "/");

  return (
    <aside
      className={`${WIDTH} shrink-0 border-r border-white/10 bg-[#0b0b0b] transition-all duration-300 h-screen flex flex-col min-h-0`}
    >
      {/* Header */}
      <div className="relative h-14 shrink-0">
        <div
          className={[
            "absolute left-4 inset-y-0 flex items-center",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
          ].join(" ")}
        >
          <div className="text-2xl font-semibold tracking-tight">
            HAYDOSFX
          </div>
        </div>

        <div className="absolute right-2 inset-y-0 flex items-center">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="grid place-items-center h-8 w-8 rounded-md hover:bg-white/10 transition"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      <nav className="px-2 pb-4 overflow-y-auto min-h-0 flex-1">
        {/* ===== MAIN NAV ===== */}
        <ul className={ITEM_SPACE}>
          {MAIN.map(({ href, label, emoji, icon: Icon }: any) => {
            const active = isActiveMain(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "flex items-center rounded-md transition-colors",
                    ITEM_PAD,
                    active ? ACTIVE : INACTIVE,
                    collapsed ? "justify-center" : "gap-3",
                  ].join(" ")}
                  title={collapsed ? label : ""}
                >
                  {Icon ? (
                    <Icon size={16} />
                  ) : (
                    <span className="text-base leading-none">{emoji}</span>
                  )}
                  {!collapsed && (
                    <span className="whitespace-nowrap">{label}</span>
                  )}
                </Link>
              </li>
            );
          })}

          {/* ===== SIMPLE DIVIDER ABOVE LEARN ===== */}
          <li className="pt-3 pb-2">
            <div className="mx-1 border-t border-white/10" />
          </li>

          {/* ===== LEARN ===== */}
          <li>
            <Link
              href={LEARN.href}
              className={[
                "flex items-center rounded-md transition-colors",
                ITEM_PAD,
                inLearn ? ACTIVE : INACTIVE,
                collapsed ? "justify-center" : "gap-3",
              ].join(" ")}
              title={collapsed ? LEARN.label : ""}
            >
              <span className="text-base leading-none">{LEARN.emoji}</span>
              {!collapsed && (
                <div className="flex flex-col leading-tight">
                  <span className="whitespace-nowrap">{LEARN.label}</span>
                  <span className="text-[11px] text-white/45 whitespace-nowrap">
                    {LEARN.sub}
                  </span>
                </div>
              )}
            </Link>
          </li>
        </ul>

        {/* ===== Calendar subnav ===== */}
        {inCalendar && (
          <>
            <div className="mx-1 my-5 border-t border-white/10" />
            {!collapsed && (
              <div className="px-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Calendar
              </div>
            )}
            <ul className="mt-2 space-y-1">
              {calendarSubpage && (
                <li>
                  <Link
                    href="/calendar"
                    className={[
                      "flex items-center rounded-md px-3 py-2 transition-colors text-sm",
                      pathname === "/calendar" ? ACTIVE : INACTIVE,
                      collapsed ? "justify-center" : "gap-2",
                    ].join(" ")}
                  >
                    <ArrowLeft size={14} />
                    {!collapsed && <span>Back to Calendar</span>}
                  </Link>
                </li>
              )}
              {CAL_SUB.map(({ href, label, Icon }) => {
                const active = pathname === href;
                const isLive = href === "/calendar/live-news";
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={[
                        "flex items-center rounded-md px-3 py-2 transition-colors text-sm",
                        active ? ACTIVE : INACTIVE,
                        collapsed ? "justify-center" : "gap-2",
                      ].join(" ")}
                    >
                      <Icon
                        size={14}
                        className={isLive ? pulseClass : ""}
                      />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* ===== Economy subnav ===== */}
        {inEconomy && (
          <>
            <div className="mx-1 my-5 border-t border-white/10" />
            {!collapsed && (
              <div className="px-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Economy
              </div>
            )}
            <ul className="mt-2 space-y-1">
              {economySubpage && (
                <li>
                  <Link
                    href="/economy"
                    className={[
                      "flex items-center rounded-md px-3 py-2 transition-colors text-sm",
                      pathname === "/economy" ? ACTIVE : INACTIVE,
                      collapsed ? "justify-center" : "gap-2",
                    ].join(" ")}
                  >
                    <ArrowLeft size={14} />
                    {!collapsed && <span>Back to Economy</span>}
                  </Link>
                </li>
              )}
              {ECON_SUB.map(({ href, label, flag, iconOnly }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={[
                        "flex items-center rounded-md px-3 py-2 transition-colors text-[13px]",
                        active ? ACTIVE : INACTIVE,
                        collapsed ? "justify-center" : "gap-2",
                      ].join(" ")}
                      title={collapsed ? label : ""}
                    >
                      {iconOnly ? (
                        <GitCompare size={14} />
                      ) : (
                        <Iconify icon={flag!} width={14} height={14} />
                      )}
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* ===== DISCREET ADMIN ACCESS ===== */}
      <div className="shrink-0 px-2 pb-3">
        <div className="mx-1 mb-2 border-t border-white/10" />
        <Link
          href={ADMIN.href}
          className={[
            "flex items-center rounded-md transition-colors text-slate-500 hover:text-white hover:bg-white/5",
            collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5",
            inAdmin ? "text-white bg-white/5" : "",
          ].join(" ")}
          title={collapsed ? ADMIN.label : ""}
          aria-label={ADMIN.label}
        >
          <ADMIN.icon size={16} />
          {!collapsed && (
            <span className="whitespace-nowrap text-sm">Admin</span>
          )}
        </Link>
      </div>
    </aside>
  );
}