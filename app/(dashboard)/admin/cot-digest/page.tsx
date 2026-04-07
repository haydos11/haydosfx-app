import { requireAdminUser } from "@/lib/admin/require-admin";
import CotDigestAdminPanel from "@/components/admin/CotDigestAdminPanel";

export default async function CotDigestAdminPage() {
  await requireAdminUser();
  return <CotDigestAdminPanel />;
}