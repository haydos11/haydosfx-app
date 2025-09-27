// app/(dashboard)/cot/components/RangeControls.tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PRESETS = [
  { key: "ytd", label: "YTD" },
  { key: "1y",  label: "1Y"  },
  { key: "3y",  label: "3Y"  },
  { key: "5y",  label: "5Y"  },
  { key: "max", label: "MAX" },
];

export default function RangeControls() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = sp.get("range") ?? "5y";

  function setRange(next: string) {
    const nextParams = new URLSearchParams(sp);
    nextParams.set("range", next);
    router.replace(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => setRange(p.key)}
          className={[
            "rounded-full px-3 py-1.5 text-sm border transition-colors",
            range === p.key
              ? "bg-violet-600 text-white border-violet-500"
              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
