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
} from "lucide-react";
import { Icon as Iconify } from "@iconify/react";

/* ---- main nav (emoji) ---- */
const MAIN = [
  { href: "/currency-strength", label: "Currency Strength", emoji: "💪" },
  { href: "/partners", label: "Partners", emoji: "🤝" },
  { href: "/currencies",        label: "Currency Charts",   emoji: "💱" },
  { href: "/cot",               label: "COT Reports",        emoji: "📊" },
  { href: "/economy",           label: "Economy",           emoji: "🌍" },
  //{ href: "/calendar",          label: "Calendar",          emoji: "🗓️" },
 // { href: "/dev-calendar",      label: "Dev-Calendar",          emoji: "🗓️" },
];

/* ---- sub-nav: Calendar (Lucide) ---- */
const CAL_SUB = [
  { href: "/calendar",           label: "Events",    Icon: CalendarDays },
  { href: "/calendar/live-news", label: "Live News", Icon: Zap },
];

/* ---- sub-nav: Economy (existing only) ---- */
const ECON_SUB = [
  { href: "/economy/us",      label: "United States", flag: "circle-flags:us" },
  { href: "/economy/compare", label: "Compare",       iconOnly: true }, // GitCompare
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // persist collapsed state
  useEffect(() => {
    const v = localStorage.getItem("sidebar:collapsed");
    if (v) setCollapsed(v === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // widths: collapsed 64px; expanded 224px (narrower than before)
  const WIDTH = collapsed ? "w-16" : "w-56";
  const ITEM_SPACE = "space-y-1.5";                 // same both states
  const ITEM_PAD = collapsed ? "px-0 py-2" : "px-3.5 py-2.5";
  const ACTIVE = "text-white";
  const INACTIVE = "text-slate-300 hover:text-white";

  const isActiveMain = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const inEconomy = pathname.startsWith("/economy");
  const economySubpage = inEconomy && pathname !== "/economy";

  const inCalendar = pathname.startsWith("/calendar");
  const calendarSubpage = inCalendar && pathname !== "/calendar";

  const liveNewsActive = pathname === "/calendar/live-news";
  const pulseClass = liveNewsActive ? "animate-pulse" : "";

  return (
    <aside
      className={`${WIDTH} shrink-0 border-r border-white/10 bg-[#0b0b0b] overflow-hidden transition-all duration-300`}
    >
      {/* Header: fixed height; absolute brand; perfectly-centered toggle */}
      <div className="relative h-14">
        {/* Brand (doesn't take width; fades when collapsed) */}
        <div
          className={[
            "absolute left-4 inset-y-0 flex items-center",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100",
          ].join(" ")}
        >
          <div className="text-2xl font-semibold tracking-tight">HAYDOSFX</div>
        </div>

        {/* Toggle container: pinned to right, centered vertically */}
        <div className="absolute right-2 inset-y-0 flex items-center">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="grid place-items-center h-8 w-8 rounded-md hover:bg-white/10 transition"
            title={collapsed ? "Expand" : "Collapse"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              // small optical nudge to center the menu glyph
              <Menu size={18} className="translate-y-[0.5px]" />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        </div>
      </div>

      <nav className="px-2 pb-8">
        {/* Main (emoji) */}
        <ul className={ITEM_SPACE}>
          {MAIN.map(({ href, label, emoji }) => {
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
                  aria-label={collapsed ? label : undefined}
                >
                  <span className="text-base leading-none">{emoji}</span>
                  {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Calendar subnav */}
        {inCalendar && (
          <>
            <div className="mx-1 my-5 border-t border-white/10" />
            {!collapsed && (
              <div className="px-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Calendar
              </div>
            )}
            <ul className="mt-2 space-y-1.5">
              {calendarSubpage && (
                <li>
                  <Link
                    href="/calendar"
                    className={[
                      "flex items-center rounded-md px-3 py-2 transition-colors",
                      pathname === "/calendar" ? ACTIVE : INACTIVE,
                      collapsed ? "justify-center" : "gap-2",
                    ].join(" ")}
                    title={collapsed ? "Back to Calendar" : ""}
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
                        "flex items-center rounded-md px-3 py-2 transition-colors",
                        active ? ACTIVE : INACTIVE,
                        collapsed ? "justify-center" : "gap-2",
                      ].join(" ")}
                      title={collapsed ? label : ""}
                      aria-label={collapsed ? label : undefined}
                    >
                      <Icon size={14} className={isLive ? pulseClass : ""} />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* Economy subnav (US flag + Compare only) */}
        {inEconomy && (
          <>
            <div className="mx-1 my-5 border-t border-white/10" />
            {!collapsed && (
              <div className="px-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Economy
              </div>
            )}
            <ul className="mt-2 space-y-1.5">
              {economySubpage && (
                <li>
                  <Link
                    href="/economy"
                    className={[
                      "flex items-center rounded-md px-3 py-2 transition-colors",
                      pathname === "/economy" ? ACTIVE : INACTIVE,
                      collapsed ? "justify-center" : "gap-2",
                    ].join(" ")}
                    title={collapsed ? "Back to Economy" : ""}
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
                        "flex items-center rounded-md px-3 py-2 transition-colors",
                        active ? ACTIVE : INACTIVE,
                        collapsed ? "justify-center" : "gap-2",
                      ].join(" ")}
                      title={collapsed ? label : ""}
                      aria-label={collapsed ? label : undefined}
                    >
                      {iconOnly ? (
                        <GitCompare size={14} />
                      ) : (
                        <Iconify icon={flag!} width={14} height={14} />
                      )}
                      {!collapsed && <span>{label}</span>}
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
