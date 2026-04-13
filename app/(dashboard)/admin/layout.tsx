import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/admin/require-admin";
import AdminSubnav from "@/components/admin/AdminSubnav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminUser();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 text-neutral-100">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.18em] text-neutral-400">
          <span>Admin</span>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Admin Control Room
        </h1>

        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Internal tools for market research, billing, automation, publishing,
          and operational workflows.
        </p>
      </div>

      <AdminSubnav />

      {children}
    </div>
  );
}