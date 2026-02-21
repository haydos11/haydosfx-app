"use client";

import Image from "next/image";
import Link from "next/link";
import type { Partner } from "../data";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
      {text}
    </span>
  );
}

export default function PartnerCard({ partner }: { partner: Partner }) {
  const isRecommended = partner.badges?.includes("Recommended");

  return (
    <article
      className={cx(
        "rounded-2xl border bg-white/5 p-5 backdrop-blur",
        isRecommended
          ? "border-emerald-400/30 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]"
          : "border-white/10"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {partner.logo?.src ? (
              <Image
                src={partner.logo.src}
                alt={partner.logo.alt}
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-white/50">Logo</span>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white">{partner.name}</h2>
            <p className="mt-1 text-sm text-white/70">{partner.description}</p>

            {!!partner.badges?.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {partner.badges.map((b) => (
                  <Badge key={b} text={b} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href={partner.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign up (Claim Perks via My Link)
          </Link>

          {partner.website && (
            <Link
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80 hover:bg-black/30"
            >
              Website
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {partner.features.map((f) => (
          <span
            key={f}
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75"
          >
            {f}
          </span>
        ))}
      </div>

      {partner.highlight && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {partner.highlight}
        </div>
      )}

      {!!partner.perks?.length && (
        <div className="mt-6 space-y-4">
          <div className="text-sm font-semibold text-white">
  Exclusive Referral Perks
</div>
<p className="mt-1 text-xs text-white/60">
  These bonuses are only available when you sign up using my referral link above.
</p>

          <div className="space-y-4">
            {partner.perks.map((perk) => (
              <div
                key={perk.title}
                className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4"
              >
                <div className="text-sm font-semibold text-emerald-200">
                  {perk.title}
                </div>

                <ul className="mt-2 space-y-1 text-sm text-white/70">
                  {perk.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}