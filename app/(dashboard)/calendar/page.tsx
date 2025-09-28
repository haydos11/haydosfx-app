// app/(dashboard)/calendar/page.tsx (Server Component)
export const dynamic = "force-dynamic";
export const revalidate = 0;

import CalendarClient from "./CalendarClient";

export default function Page() {
  return <CalendarClient />;
}
