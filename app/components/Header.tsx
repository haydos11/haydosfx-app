"use client";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="w-full border-b border-neutral-800 bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-wide">Haydos FX</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cot" className="hover:underline">COT Dashboard</Link>
          <a
            href="https://blackbull.com/en/live-account/?cmp=5p0z2d3q&refid=5500"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            <Image
              src="/blackbullmarkets65.png"
              alt="BlackBull Markets"
              width={120}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span>Trade with BlackBull</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
