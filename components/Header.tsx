import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/70 backdrop-blur supports-[backdrop-filter]:bg-slate-950/40">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-6 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30" />
          <span className="text-sm font-semibold tracking-wide">HaydosFX</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/fx-strength" className="text-sm text-slate-300 hover:text-white">FX Strength</Link>
          <a
            href="https://YOUR-BLACKBULL-AFFILIATE-LINK"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
            title="Open BlackBull (affiliate)"
          >
            BlackBull
          </a>
        </nav>
      </div>
    </header>
  );
}
