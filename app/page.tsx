import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8 text-white">
      <h1 className="text-3xl font-bold">Haydos FX Dashboard</h1>

      {/* Grid now 1 col (mobile), 2 cols (tablet), 3 cols (desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* COT Dashboard card */}
        <Link
          href="/cot"
          className="group block rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 hover:bg-neutral-900/60 transition"
        >
          <h2 className="text-xl font-semibold mb-2">COT Dashboard</h2>
          <p className="text-neutral-400 group-hover:text-neutral-200">
            Commitment of Traders data with charts and analysis.
          </p>
        </Link>

        {/* FX Strength Map card with "New" badge */}
        <Link
          href="/fx-strength"
          className="group block rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 hover:bg-neutral-900/60 transition relative"
        >
          {/* Purple "New" badge */}
          <span className="absolute top-4 right-4 bg-purple-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
            New
          </span>

          <h2 className="text-xl font-semibold mb-2">FX Strength Map</h2>
          <p className="text-neutral-400 group-hover:text-neutral-200">
            Interactive world map with ranked currency strength.
          </p>
        </Link>

        {/* BlackBull referral card */}
        <a
          href="https://blackbull.com/en/live-account/?cmp=5p0z2d3q&refid=5500"
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 hover:bg-neutral-900/60 transition"
        >
          <div className="flex items-center gap-3">
            <Image
              src="/blackbullmarkets65.png"
              alt="BlackBull Markets"
              width={160}
              height={40}
              className="h-8 w-auto"
            />
            <h2 className="text-xl font-semibold">Trade with BlackBull</h2>
          </div>
          <p className="mt-2 text-neutral-400 group-hover:text-neutral-200">
            Open a live account with BlackBull Markets and start trading with our partner broker.
          </p>
        </a>
      </div>
    </main>
  );
}
