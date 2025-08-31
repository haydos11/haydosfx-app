"use client";
import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full border-b border-neutral-800 bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-wide">Haydos FX</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cot" className="hover:underline">COT Dashboard</Link>
          <a
            href="https://YOUR-BLACKBULL-AFFILIATE-LINK"
            target="_blank" rel="noreferrer"
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            Trade with BlackBull
          </a>
        </nav>
      </div>
    </header>
  );
}
