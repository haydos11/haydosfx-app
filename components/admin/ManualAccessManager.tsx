"use client";

import { useMemo, useState } from "react";

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

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB");
}

function isManualGrantCurrentlyValid(row: {
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
}) {
  if (!row.is_active) return false;

  const now = Date.now();

  if (row.starts_at) {
    const startsAt = new Date(row.starts_at).getTime();
    if (!Number.isNaN(startsAt) && now < startsAt) {
      return false;
    }
  }

  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at).getTime();
    if (!Number.isNaN(expiresAt) && now > expiresAt) {
      return false;
    }
  }

  return true;
}

function AccessPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-neutral-300",
      ].join(" ")}
    >
      {active ? "active" : "inactive"}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: number;
  accent?: "neutral" | "green" | "amber" | "red" | "violet";
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-300"
      : accent === "amber"
        ? "text-amber-300"
        : accent === "red"
          ? "text-red-300"
          : accent === "violet"
            ? "text-violet-300"
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

export default function ManualAccessManager({
  rows,
}: {
  rows: ManualAccessRow[];
}) {
  const [email, setEmail] = useState("");
  const [featureKey, setFeatureKey] = useState("premium");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [rows]
  );

  const stats = useMemo(() => {
    const activeNow = rows.filter(isManualGrantCurrentlyValid).length;
    const inactive = rows.filter((row) => !row.is_active).length;
    const expired = rows.filter(
      (row) =>
        row.is_active &&
        !!row.expires_at &&
        new Date(row.expires_at).getTime() < Date.now()
    ).length;
    const premium = rows.filter((row) => row.feature_key === "premium").length;

    return {
      total: rows.length,
      activeNow,
      inactive,
      expired,
      premium,
    };
  }, [rows]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/billing/manual-access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          feature_key: featureKey,
          reason,
          starts_at: startsAt || null,
          expires_at: expiresAt || null,
          granted_by: "admin",
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed creating manual access");
      }

      setMessage("Manual access granted.");
      setEmail("");
      setFeatureKey("premium");
      setReason("");
      setStartsAt("");
      setExpiresAt("");
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed creating manual access"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setBusyId(id);
    setMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/billing/manual-access/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          is_active: isActive,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed updating manual access");
      }

      setMessage(isActive ? "Access reactivated." : "Access revoked.");
      window.location.reload();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed updating manual access"
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Manual total" value={stats.total} />
        <StatCard label="Active now" value={stats.activeNow} accent="green" />
        <StatCard label="Premium grants" value={stats.premium} accent="violet" />
        <StatCard label="Expired" value={stats.expired} accent="amber" />
        <StatCard label="Revoked" value={stats.inactive} accent="red" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Manual access</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Grant gifted or admin-managed access outside Stripe. This does not change
          billing records, but it can provide the same effective premium access.
        </p>

        <form onSubmit={handleCreate} className="mt-6 grid gap-4 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              placeholder="name@example.com"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">
              Feature
            </label>
            <select
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="premium">premium</option>
              <option value="discord_premium">discord_premium</option>
              <option value="tradingview_indicators">tradingview_indicators</option>
              <option value="emabot_license">emabot_license</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">
              Starts
            </label>
            <input
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              type="datetime-local"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">
              Expires
            </label>
            <input
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              type="datetime-local"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Grant access"}
            </button>
          </div>

          <div className="lg:col-span-6">
            <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">
              Reason
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Gifted access, beta tester, goodwill, internal team..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20"
            />
          </div>
        </form>

        {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
        {errorMessage ? (
          <p className="mt-4 text-sm text-red-300">{errorMessage}</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 bg-black/20 px-4 py-3">
          <div className="text-sm text-neutral-300">
            Manual access records:{" "}
            <span className="font-medium text-white">{sortedRows.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Starts</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Granted by</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-neutral-500"
                  >
                    No manual access records yet.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 text-neutral-200"
                  >
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.feature_key}</td>
                    <td className="px-4 py-3">
                      <AccessPill active={row.is_active} />
                    </td>
                    <td className="px-4 py-3">{formatDate(row.starts_at)}</td>
                    <td className="px-4 py-3">{formatDate(row.expires_at)}</td>
                    <td className="px-4 py-3">{row.reason ?? "—"}</td>
                    <td className="px-4 py-3">{row.granted_by ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatDate(row.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => setActive(row.id, !row.is_active)}
                        className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === row.id
                          ? "Saving..."
                          : row.is_active
                            ? "Revoke"
                            : "Reactivate"}
                      </button>
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