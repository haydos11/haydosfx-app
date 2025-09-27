// app/(dashboard)/components/Sidebar.tsx
import Link from "next/link";

const items = [
  { label: "Currencies", href: "/fx-strength", badge: null },
  { label: "COT Report", href: "#",            badge: null },
  { label: "Economy",    href: "#",            badge: null },
  { label: "Calendar",   href: "/calendar",    badge: null },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-full shrink-0 flex-col border-r border-slate-800 bg-slate-950/50">
      <div className="px-3 py-3 text-[11px] font-semibold tracking-wide text-slate-400">
        HAYDOSFX
      </div>

      <nav className="flex-1 space-y-1 px-2 pb-3">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="group flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            <span className="truncate">{it.label}</span>
            {it.badge && (
              <span className="ml-2 inline-flex items-center rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                {it.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-2 text-[11px] text-slate-500">FX • Hayden</div>
    </aside>
  );
}
