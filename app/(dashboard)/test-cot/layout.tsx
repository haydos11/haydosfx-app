// app/(dashboard)/test-cot/layout.tsx
import { ReactNode } from "react";
import { requirePremium } from "@/lib/auth/require-premium";

export default async function TestCotLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePremium("/test-cot");

  return <>{children}</>;
}