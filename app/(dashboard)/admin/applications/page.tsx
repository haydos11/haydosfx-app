import "server-only";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Applications | Admin",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ status }: { status: string }) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold";
  if (status === "approved")
    return (
      <span className={cn(base, "border-emerald-400/30 bg-emerald-500/10 text-emerald-100")}>
        Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className={cn(base, "border-rose-400/30 bg-rose-500/10 text-rose-100")}>
        Rejected
      </span>
    );
  return (
    <span className={cn(base, "border-indigo-400/30 bg-indigo-500/10 text-indigo-100")}>
      Pending
    </span>
  );
}

export default async function AdminApplicationsPage() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("premium_applications")
    .select(
      "id, created_at, status, name, email, discord_alias, tradingview_name, trading_style, experience, other_groups, additional_info"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <h1 className="text-xl font-semibold text-white">Admin — Applications</h1>
        <pre className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-200">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Applications</h1>
          <p className="mt-1 text-sm text-slate-400">
            Latest 50 Premium applications (newest first).
          </p>
        </div>

        <Link
          href="/premium/apply"
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
        >
          View public form
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.03] text-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Discord</th>
                <th className="px-4 py-3 font-semibold">TradingView</th>
                <th className="px-4 py-3 font-semibold">Style</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {(data ?? []).map((row) => (
                <tr key={row.id} className="align-top text-slate-300">
                  <td className="px-4 py-3">
                    <Badge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-100">{row.name}</td>
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">{row.discord_alias ?? "-"}</td>
                  <td className="px-4 py-3">{row.tradingview_name ?? "-"}</td>
                  <td className="px-4 py-3">{row.trading_style ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Details blocks */}
        <div className="divide-y divide-white/10">
          {(data ?? []).map((row) => (
            <details key={`${row.id}-details`} className="group px-4 py-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-indigo-100 hover:text-indigo-50">
                View answers — {row.name} ({row.email})
              </summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs font-semibold text-slate-200">Experience</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {row.experience ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs font-semibold text-slate-200">Other groups</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {row.other_groups ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
                  <div className="text-xs font-semibold text-slate-200">Additional info</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {row.additional_info ?? "-"}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}