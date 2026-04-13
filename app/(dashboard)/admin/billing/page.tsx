function BillingCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-xl font-semibold text-white">Billing</h2>

      <p className="mt-2 max-w-3xl text-sm text-neutral-400">
        This area will handle billing-linked automation such as subscriber
        onboarding, Discord access, premium entitlements, and payment operations.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-neutral-200">
            Subscriber automation
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Invite users to Discord, assign roles, trigger premium access, and
            track onboarding state.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-neutral-200">
            Payment operations
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Review customers, subscription events, failed-payment flows, and
            future billing provider integrations.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminBillingPage() {
  return <BillingCard />;
}