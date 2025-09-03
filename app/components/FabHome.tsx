"use client";
import Link from "next/link";
import { Home } from "lucide-react"; // npm i lucide-react

export default function FabHome() {
  return (
    <Link
      href="/"
      className="fixed top-4 left-4 z-40 rounded-full p-3 bg-slate-900/80 border border-slate-800 shadow-lg hover:bg-slate-800/80 transition"
      aria-label="Go to homepage"
      title="Home"
    >
      <Home className="h-5 w-5 text-white" />
    </Link>
  );
}
