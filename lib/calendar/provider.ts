export type EconCalendarItem = {
  id: string;
  date: string;
  country: string;
  event: string;
  actual: string | null;
  forecast?: string | null;
  estimate?: string | null;
  previous: string | null;
  revised: string | null;
  deviation: number | null;
  importance?: number | null;
};

export type FetchArgs = {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
  q?: string;
  countries?: string[];
  page?: number;
  pageSize?: number;
};

export async function fetchCalendar({ start, end, q, countries, page=1, pageSize=50 }: FetchArgs) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end)   params.set("end", end);
  if (q)     params.set("q", q);
  if (countries?.length) params.set("countries", countries.join(","));
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const res = await fetch(`/api/calendar/query?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`query failed ${res.status}`);
  const json = await res.json();
  return (json?.data ?? []) as EconCalendarItem[];
}
