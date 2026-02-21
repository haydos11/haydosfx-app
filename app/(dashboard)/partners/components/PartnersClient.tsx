"use client";

import { PARTNERS } from "../data";
import PartnerCard from "./PartnerCard";

export default function PartnersClient() {
  const partners = [...PARTNERS].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );

  return (
    <div className="relative">
      {/* subtle background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute right-[-240px] top-[35%] h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Partners
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Brokerages and platforms I personally use and recommend.
            Exclusive perks are only available when signing up via my referral link.
          </p>
        </div>

        <div className="grid gap-6">
          {partners.map((partner) => (
            <PartnerCard key={partner.slug} partner={partner} />
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
          <span className="font-semibold text-white/70">Disclosure:</span>{" "}
          Some links on this page may be affiliate/referral links. If you sign up
          through them, I may receive a commission. This helps fund the site and
          research tools.
        </div>
      </div>
    </div>
  );
}