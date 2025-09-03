"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();

  function handleBack() {
    // If there’s no meaningful history (e.g., direct entry), go home
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push("/");
    } else {
      router.back();
    }
  }

  const onHome = pathname === "/";

  return (
    <div className="fixed inset-x-0 top-0 z-40 bg-slate-900/70 backdrop-blur border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 h-12 flex items-center justify-between">
        {/* Left: Back */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/60 active:scale-[0.98] transition disabled:opacity-50"
          title="Back"
          aria-label="Go back"
          disabled={onHome}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Center: Page title placeholder (optional) */}
        <div className="text-slate-200 text-sm font-medium truncate px-2">
          {/* You can inject a breadcrumb or page title here if you want */}
        </div>

        {/* Right: Home */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/60 active:scale-[0.98] transition"
          title="Home"
          aria-label="Go to homepage"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      </div>
    </div>
  );
}
