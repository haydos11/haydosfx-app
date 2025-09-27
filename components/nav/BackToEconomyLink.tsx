"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shows "← Back to Economy" on any /economy/* subpage,
 * but hides it on the /economy hub itself.
 */
export default function BackToEconomyLink() {
  const pathname = usePathname();
  const onHub = pathname === "/economy";
  if (onHub) return null;

  return (
    <Link href="/economy" className="text-slate-400 hover:text-slate-200 text-sm">
      ← Back to Economy
    </Link>
  );
}
