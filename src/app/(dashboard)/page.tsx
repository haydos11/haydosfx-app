// src/app/page.tsx
import Link from "next/link";
import { ArrowRight, LineChart, CalendarDays, Newspaper, Database, Settings, BarChart2 } from "lucide-react";

type Section = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
};

const SECTIONS: Section[] = [
  {
    href: "/currency-strength",
    title: "Currency Strength",
    description: "Daily strength, breadth, and rotation. Spot leaders/laggards fast.",
    icon: <LineChart className="h-6 w-6" />,
  },
  {
    href: "/calendar",
    title: "Economic Calendar",
    description: "Upcoming and historical events with actual/forecast/previous.",
    icon: <CalendarDays className="h-6 w-6" />,
  },
  {
    href: "/cot",
    title: "COT Dashboard",
    description: "Futures positioning and net notional context by asset.",
    icon: <BarChart2 className="h-6 w-6" />,
  },
  {
    href: "/news",
    title: "Live News",
    description: "Clean feed from multiple sources with quick summaries.",
    icon: <Newspaper className="h-6 w-6" />,
  },
  {
    href: "/research",
    title: "Research Lab",
    description: "Correlations, session stats, range studies, custom logic.",
    icon: <Database className="h-6 w-6" />,
    badge: "Beta",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Time zone, data sources, and display preferences.",
    icon: <Settings className="h-6 w-6" />,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-slate-200">
      <header className="mx-auto max-w-6xl px-6 pt-16 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-2 text-slate-400">
          Pick a section below to get started.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent p-5 transition-colors hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-white/5 p-3">{s.icon}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-medium">{s.title}</h2>
                    {s.badge ? (
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                        {s.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                    {s.description}
                  </p>
                </div>
              </div>

              <div className="pointer-events-none absolute right-4 top-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                <ArrowRight className="h-5 w-5 text-slate-300" />
              </div>
            </Link>
          ))}
        </div>

        {/* Quick links row */}
        <div className="mt-10 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-400">Shortcuts:</span>
          {SECTIONS.slice(0, 4).map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-md border border-white/10 px-3 py-1.5 text-slate-300 hover:border-white/20"
            >
              {s.title}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
