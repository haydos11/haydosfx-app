import BillingSyncButton from "@/components/admin/BillingSyncButton";
import BillingAdminTable from "@/components/admin/BillingAdminTable";
import ManualAccessManager from "@/components/admin/ManualAccessManager";
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
  on_hold: boolean;
  hold_type: string | null;
  hold_resumes_at: string | null;
  updated_at: string;
};

type ManualAccessRow = {
  id: string;
  user_id: string | null;
  email: string;
  feature_key: string;
  is_active: boolean;
  reason: string | null;
  starts_at: string | null;
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
};

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
      on_hold,
      hold_type,
      hold_resumes_at,
      updated_at
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed loading billing records:", error.message);
    return [];
  }

  return (data ?? []) as BillingRow[];
}

async function getManualAccessRows(): Promise<ManualAccessRow[]> {
  const supabase = getAppSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_manual_access")
    .select(`
      id,
      user_id,
      email,
      feature_key,
      is_active,
      reason,
      starts_at,
      expires_at,
      granted_by,
      created_at,
      updated_at
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed loading manual access rows:", error.message);
    return [];
  }

  return (data ?? []) as ManualAccessRow[];
}

export default async function AdminBillingPage() {
  const [rows, manualRows] = await Promise.all([
    getBillingRows(),
    getManualAccessRows(),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Billing</h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-400">
              Stripe-synced premium access records plus a separate manual access
              control panel. Stripe remains the billing source of truth, while
              manual grants can provide the same effective premium access when needed.
            </p>
          </div>

          <div className="min-w-[280px]">
            <BillingSyncButton />
          </div>
        </div>
      </div>

      <BillingAdminTable rows={rows} />
      <ManualAccessManager rows={manualRows} />
    </div>
  );
}