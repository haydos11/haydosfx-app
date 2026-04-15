import { getAppSupabaseAdmin } from "@/lib/supabase/appAdmin";

type BillingRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan_key: string | null;
  subscription_status: string | null;
  premium_active: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
};

function StatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-neutral-300",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

async function getBillingRows(): Promise<BillingRow[]> {
  const supabase = getAppSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_customer_access")
    .select(`
      id,
      user_id,
      email,
      stripe_customer_id,
      stripe_subscription_id,
      plan_key,
      subscription_status,
      premium_active,
      current_period_end,
      cancel_at_period_end,
      updated_at
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed loading billing records:", error.message);
    return [];
  }

  return (data ?? []) as BillingRow[];
}

export default async function AdminBillingPage() {
  const rows = await getBillingRows();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h1 className="text-xl font-semibold text-white">Billing</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Stripe-synced premium access records. This is the first layer that will
          later drive Discord access, TradingView provisioning, and EMABot licences.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Premium</th>
                <th className="px-4 py-3 font-medium">Period end</th>
                <th className="px-4 py-3 font-medium">Cancel end</th>
                <th className="px-4 py-3 font-medium">Stripe customer</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-neutral-500"
                  >
                    No Stripe-synced billing records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 text-neutral-200"
                  >
                    <td className="px-4 py-3">{row.email ?? "—"}</td>
                    <td className="px-4 py-3">{row.plan_key ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.subscription_status ? (
                        <StatusPill
                          active={
                            row.subscription_status === "active" ||
                            row.subscription_status === "trialing"
                          }
                          label={row.subscription_status}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        active={row.premium_active}
                        label={row.premium_active ? "active" : "inactive"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.current_period_end
                        ? new Date(row.current_period_end).toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.cancel_at_period_end ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                      {row.stripe_customer_id}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {new Date(row.updated_at).toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}