// src/app/(dashboard)/layout.tsx
import SidebarNav from "../../../components/nav/SidebarNav";

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-black text-slate-200">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
