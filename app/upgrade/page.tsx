import Link from "next/link";

export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          Premium access required
        </h1>
        <p className="mt-4 text-white/70">
          Test COT is currently available to premium members only.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/services"
            className="rounded-xl border border-white/15 px-5 py-3 hover:bg-white/5"
          >
            View membership options
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-white/10 px-5 py-3 hover:bg-white/5"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}