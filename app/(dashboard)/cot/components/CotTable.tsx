"use client";
import type { CotRow } from "@/lib/cot/shape";

export default function CotTable({ recent }: { recent: CotRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 text-sm font-medium border-b border-white/10">Recent COT Data</div>
      <table className="min-w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-right px-4 py-3">Large Specs Net</th>
            <th className="text-right px-4 py-3">Δ</th>
            <th className="text-right px-4 py-3">Small Traders Net</th>
            <th className="text-right px-4 py-3">Δ</th>
            <th className="text-right px-4 py-3">Commercials Net</th>
            <th className="text-right px-4 py-3">Δ</th>
            <th className="text-right px-4 py-3">Open Interest</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r, i) => (
            <tr key={`${r.date}-${i}`} className="border-t border-white/5">
              <td className="px-4 py-2 text-slate-300">{r.date}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.large_spec_net.toLocaleString()}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${(r.d_large ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {(r.d_large ?? 0) >= 0 ? "+" : ""}{(r.d_large ?? 0).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{r.small_traders_net.toLocaleString()}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${(r.d_small ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {(r.d_small ?? 0) >= 0 ? "+" : ""}{(r.d_small ?? 0).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{r.commercials_net.toLocaleString()}</td>
              <td className={`px-4 py-2 text-right tabular-nums ${(r.d_comm ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {(r.d_comm ?? 0) >= 0 ? "+" : ""}{(r.d_comm ?? 0).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{r.open_interest?.toLocaleString?.() ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
