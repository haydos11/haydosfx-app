import Link from "next/link";

type CardProps = {
  href: string;
  title: string;
  subtitle: string;
};

function Card({ href, title, subtitle }: CardProps) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
    >
      <div className="text-lg font-semibold text-slate-100">{title}</div>
      <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
    </Link>
  );
}

export default function EconomyHub() {
  return (
    <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card
        href="/economy/us"
        title="United States"
        subtitle="Core macro dashboard"
      />
      <Card
        href="/economy/compare"
        title="Compare"
        subtitle="Cross-country & cross-metric"
      />
    </div>
  );
}
