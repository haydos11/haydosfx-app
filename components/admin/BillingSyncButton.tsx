"use client";

import { useState } from "react";

type SyncState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function BillingSyncButton() {
  const [state, setState] = useState<SyncState>({ kind: "idle" });

  async function handleSync() {
    try {
      setState({ kind: "loading" });

      const res = await fetch("/api/admin/stripe/sync", {
        method: "POST",
      });

      const text = await res.text();

      let payload: {
        ok?: boolean;
        processed?: number;
        premiumCount?: number;
      } | null = null;

      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (!res.ok) {
        throw new Error(text || "Stripe sync failed");
      }

      setState({
        kind: "success",
        message: `Synced ${payload?.processed ?? 0} subscriptions. Premium active: ${payload?.premiumCount ?? 0}.`,
      });

      window.location.reload();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Stripe sync failed",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={handleSync}
        disabled={state.kind === "loading"}
        className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.kind === "loading" ? "Syncing Stripe..." : "Sync Stripe subscriptions"}
      </button>

      {state.kind === "success" ? (
        <p className="text-sm text-emerald-300">{state.message}</p>
      ) : null}

      {state.kind === "error" ? (
        <p className="text-sm text-red-300">{state.message}</p>
      ) : null}
    </div>
  );
}