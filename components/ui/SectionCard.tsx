import * as React from "react";

type Props = React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}>;

export default function SectionCard({ title, subtitle, right, className, children }: Props) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/60 shadow-sm ${className ?? ""}`}>
      <header className="flex items-start justify-between gap-4 px-4 py-3 border-b border-slate-800">
        <div>
          {title && <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
