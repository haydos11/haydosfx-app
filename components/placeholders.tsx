export function LineChartPlaceholder() {
  return (
    <div className="h-56 w-full rounded-xl bg-gradient-to-b from-slate-800/70 to-slate-900/60 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,_white_1px,_transparent_1px)] [background-size:16px_16px]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent" />
      <div className="absolute inset-4 flex items-end gap-2">
        {[...Array(32)].map((_, i) => (
          <div
            key={i}
            className="w-1.5 rounded-t bg-emerald-400/30"
            style={{ height: `${20 + Math.abs(Math.sin(i * 0.4)) * 140}px` }}
          />
        ))}
      </div>
    </div>
  );
}

export function GaugePlaceholder() {
  return (
    <div className="h-56 w-full grid place-items-center">
      <div className="relative">
        <div className="size-40 rounded-full border-8 border-slate-800" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-3xl font-bold">44</span>
          <p className="text-xs text-slate-400 mt-1">Neutral Outlook</p>
        </div>
      </div>
    </div>
  );
}

export function BarsPlaceholder() {
  const rows = [
    { label: "Technology", v: 75 },
    { label: "Nasdaq-100", v: 49 },
    { label: "Total Market", v: 32 },
    { label: "Dow Jones", v: 25 },
    { label: "S&P 500", v: 21 }
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
            <span>{r.label}</span><span className="text-slate-400">+{r.v/100}%</span>
          </div>
          <div className="h-2 w-full rounded bg-slate-800">
            <div className="h-2 rounded bg-emerald-500/70" style={{ width: `${r.v}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
