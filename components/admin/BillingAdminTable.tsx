"use client";

import { useMemo, useState } from "react";

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

type StatusFilter =
  | "all"
  | "active"
  | "past_due"
  | "canceled"
  | "cancelled"
  | "paused"
  | "unpaid";

type PremiumFilter = "all" | "active" | "inactive";
type HoldFilter = "all" | "on_hold" | "not_on_hold";

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

function HoldPill({
  onHold,
  holdType,
}: {
  onHold: boolean;
  holdType: string | null;
}) {
  if (!onHold) {
    return (
      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-300">
        no
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
      {holdType ? `yes · ${holdType}` : "yes"}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: number;
  accent?: "neutral" | "green" | "amber" | "red";
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-300"
      : accent === "amber"
        ? "text-amber-300"
        : accent === "red"
          ? "text-red-300"
          : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}

function normaliseStatus(status: string | null) {
  if (!status) return "";
  return status.toLowerCase();
}

function isStripeOperationallyActive(row: BillingRow) {
  return (
    normaliseStatus(row.subscription_status) === "active" &&
    row.premium_active &&
    !row.on_hold
  );
}

function matchesStatusFilter(row: BillingRow, filter: StatusFilter) {
  if (filter === "all") return true;

  const status = normaliseStatus(row.subscription_status);

  if (filter === "canceled" || filter === "cancelled") {
    return status === "canceled" || status === "cancelled";
  }

  return status === filter;
}

function matchesPremiumFilter(row: BillingRow, filter: PremiumFilter) {
  if (filter === "all") return true;
  if (filter === "active") return row.premium_active;
  return !row.premium_active;
}

function matchesHoldFilter(row: BillingRow, filter: HoldFilter) {
  if (filter === "all") return true;
  if (filter === "on_hold") return row.on_hold;
  return !row.on_hold;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB");
}

export default function BillingAdminTable({ rows }: { rows: BillingRow[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>("active");
  const [holdFilter, setHoldFilter] = useState<HoldFilter>("not_on_hold");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const liveActive = rows.filter(isStripeOperationallyActive).length;

    const pastDue = rows.filter(
      (row) => normaliseStatus(row.subscription_status) === "past_due"
    ).length;

    const cancelled = rows.filter((row) => {
      const status = normaliseStatus(row.subscription_status);
      return status === "canceled" || status === "cancelled";
    }).length;

    const paused = rows.filter(
      (row) => normaliseStatus(row.subscription_status) === "paused"
    ).length;

    const unpaid = rows.filter(
      (row) => normaliseStatus(row.subscription_status) === "unpaid"
    ).length;

    const onHold = rows.filter((row) => row.on_hold).length;

    return {
      liveActive,
      pastDue,
      cancelled,
      paused,
      unpaid,
      onHold,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (!matchesStatusFilter(row, statusFilter)) return false;
      if (!matchesPremiumFilter(row, premiumFilter)) return false;
      if (!matchesHoldFilter(row, holdFilter)) return false;

      if (!q) return true;

      const haystack = [
        row.email ?? "",
        row.stripe_customer_id ?? "",
        row.stripe_subscription_id ?? "",
        row.plan_key ?? "",
        row.subscription_status ?? "",
        row.hold_type ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, statusFilter, premiumFilter, holdFilter, query]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Active subscribers" value={stats.liveActive} accent="green" />
        <StatCard label="Past due" value={stats.pastDue} accent="amber" />
        <StatCard label="Cancelled" value={stats.cancelled} accent="red" />
        <StatCard label="Paused" value={stats.paused} accent="amber" />
        <StatCard label="Unpaid" value={stats.unpaid} accent="red" />
        <StatCard label="On hold" value={stats.onHold} accent="amber" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto] xl:items-end">
          <div>
            <label
              htmlFor="billing-search"
              className="mb-2 block text-xs uppercase tracking-wide text-neutral-500"
            >
              Search
            </label>
            <input
              id="billing-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, Stripe customer, subscription, plan..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20"
            />
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Status
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                All
              </FilterChip>
              <FilterChip active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>
                Active
              </FilterChip>
              <FilterChip active={statusFilter === "past_due"} onClick={() => setStatusFilter("past_due")}>
                Past due
              </FilterChip>
              <FilterChip active={statusFilter === "paused"} onClick={() => setStatusFilter("paused")}>
                Paused
              </FilterChip>
              <FilterChip active={statusFilter === "cancelled"} onClick={() => setStatusFilter("cancelled")}>
                Cancelled
              </FilterChip>
              <FilterChip active={statusFilter === "unpaid"} onClick={() => setStatusFilter("unpaid")}>
                Unpaid
              </FilterChip>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Premium
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={premiumFilter === "all"} onClick={() => setPremiumFilter("all")}>
                All
              </FilterChip>
              <FilterChip active={premiumFilter === "active"} onClick={() => setPremiumFilter("active")}>
                Active
              </FilterChip>
              <FilterChip active={premiumFilter === "inactive"} onClick={() => setPremiumFilter("inactive")}>
                Inactive
              </FilterChip>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Hold
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={holdFilter === "all"} onClick={() => setHoldFilter("all")}>
                All
              </FilterChip>
              <FilterChip active={holdFilter === "on_hold"} onClick={() => setHoldFilter("on_hold")}>
                On hold
              </FilterChip>
              <FilterChip
                active={holdFilter === "not_on_hold"}
                onClick={() => setHoldFilter("not_on_hold")}
              >
                Not on hold
              </FilterChip>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3">
          <div className="text-sm text-neutral-300">
            Showing <span className="font-medium text-white">{filteredRows.length}</span> of{" "}
            <span className="font-medium text-white">{rows.length}</span> Stripe records
          </div>

          <div className="text-xs text-neutral-500">
            Default view: active premium Stripe subscribers, not on hold
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Premium</th>
                <th className="px-4 py-3 font-medium">On hold</th>
                <th className="px-4 py-3 font-medium">Hold resumes</th>
                <th className="px-4 py-3 font-medium">Period end</th>
                <th className="px-4 py-3 font-medium">Cancel end</th>
                <th className="px-4 py-3 font-medium">Stripe customer</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 text-neutral-200">
                    <td className="px-4 py-3">{row.email ?? "—"}</td>
                    <td className="px-4 py-3">{row.plan_key ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.subscription_status ? (
                        <StatusPill
                          active={isStripeOperationallyActive(row)}
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
                      <HoldPill onHold={row.on_hold} holdType={row.hold_type} />
                    </td>
                    <td className="px-4 py-3">{formatDate(row.hold_resumes_at)}</td>
                    <td className="px-4 py-3">{formatDate(row.current_period_end)}</td>
                    <td className="px-4 py-3">{row.cancel_at_period_end ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                      {row.stripe_customer_id}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatDate(row.updated_at)}
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