// app/(dashboard)/calendar/live-news/page.tsx
import AppShell from "@/components/shell/AppShell";
import { fetchCombinedFeeds, type NormalizedItem } from "././server/fetchFeeds";
import { passesFilters } from "./server/filters";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 180;

type SearchParams = {
  q?: string | string[];
  from?: string | string[];
  to?: string | string[];
  days?: string | string[];
};

/* ---------- helpers ---------- */
function fmtLondon(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isoNow() {
  return new Date().toISOString();
}
function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function paramToString(v?: string | string[] | null) {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

/* ---------- server search (Supabase) ---------- */
async function searchSupabaseNews({
  q,
  fromISO,
  toISO,
  limit = 200,
}: {
  q: string;
  fromISO: string;
  toISO: string;
  limit?: number;
}): Promise<NormalizedItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("news_articles")
    .select("id,title,url,source,summary,published_at")
    .gte("published_at", fromISO)
    .lte("published_at", toISO)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (q.trim()) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NormalizedItem[];
}

/* ---------- main page ---------- */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = paramToString(sp.q).trim();

  const daysRaw = paramToString(sp.days);
  const daysNum = Number(daysRaw || "7");
  const clampedDays = Number.isFinite(daysNum)
    ? Math.max(1, Math.min(daysNum, 365))
    : 7;

  const fromISO = paramToString(sp.from) || isoDaysAgo(clampedDays);
  const toISO = paramToString(sp.to) || isoNow();

  let items: NormalizedItem[] = [];

  if (q) {
    try {
      const results = await searchSupabaseNews({
        q,
        fromISO,
        toISO,
        limit: 300,
      });
      items = results;
    } catch (err) {
      console.warn("[live-news] search error:", (err as Error)?.message ?? err);
      items = [];
    }
  } else {
    const raw = await fetchCombinedFeeds();
    items = raw.filter(passesFilters).slice(0, 160);
  }

  return (
    <AppShell
      fullBleed
      container="full"
      className="pt-2"
      title="Calendar — Live News"
      subtitle={
        <span className="text-slate-400">
          {q ? (
            <>
              Archive results for{" "}
              <span className="text-white font-medium">“{q}”</span>
            </>
          ) : (
            "Source: Macro Headlines (RSS + Polygon)"
          )}
        </span>
      }
    >
      {/* Search form */}
      <form
        className="mb-5 px-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
        action="/calendar/live-news"
        method="get"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search headlines (e.g., CPI, Powell, rate hike...)"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <div className="flex gap-2">
          <input
            name="days"
            type="number"
            min={1}
            max={365}
            defaultValue={clampedDays}
            className="w-24 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20"
            placeholder="Days"
            title="Days back to search (defaults to 7)"
          />
          <button
            type="submit"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Search
          </button>
          {q && (
            <Link
              href="/calendar/live-news"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Timeline */}
      <div className="relative pl-6 md:pl-9 selection:bg-white/20 selection:text-black">
        {/* vertical line */}
        <div className="pointer-events-none absolute left-2 md:left-3 top-0 h-full w-px bg-gradient-to-b from-white/25 via-white/10 to-transparent" />

        {items.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">
            {q
              ? "No headlines found in the selected range."
              : "No headlines matched your filters in the last refresh window."}
          </p>
        ) : (
          <ul className="space-y-4 pr-3">
            {items.map((it) => (
              <li key={it.id} className="relative group">
                {/* Time chip */}
                <div className="mb-1 pl-1">
                  <time className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 text-xs text-slate-400">
                    {fmtLondon(it.published_at)}
                  </time>
                </div>

                {/* Headline + summary + assets */}
                <div className="rounded-xl px-3 py-2 md:px-4 md:py-2.5 transition-colors hover:bg-white/[0.03]">
                  {/* clickable headline (neutral, animated underline, no purple) */}
                  <a
                    href={it.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={[
                      "block rounded-sm text-[15px] md:text-base font-medium leading-snug tracking-tight text-slate-100",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                      // animated underline (neutral)
                      "[background-image:linear-gradient(90deg,rgba(255,255,255,.75),rgba(255,255,255,.25))]",
                      "bg-left-bottom bg-no-repeat bg-[length:0%_1px] hover:bg-[length:100%_1px] transition-[background-size,color] duration-300",
                      // subtle color lift on hover (no hue shift)
                      "hover:text-white",
                      // nicer text selection just for the link
                      "selection:bg-white/20 selection:text-black",
                    ].join(" ")}
                  >
                    {it.title}
                  </a>

                  {/* summary */}
                  {it.summary && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
                      {it.summary}
                    </p>
                  )}

                  {/* asset tags */}
                  {it.assets?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {it.assets.slice(0, 6).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-[1px] rounded-md ring-1 ring-white/10 bg-white/[0.03] text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {/* neutral divider glow (no purple) */}
                  <div className="mt-2 h-px w-full bg-gradient-to-r from-white/30 via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-60" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
