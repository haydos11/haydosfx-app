import AppShell from "@/components/shell/AppShell";
import { fetchCombinedFeeds, type NormalizedItem } from "././server/fetchFeeds";
import { passesFilters } from "./server/filters";


export const runtime = "nodejs";
export const revalidate = 180;

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

export default async function Page() {
  const raw = await fetchCombinedFeeds();
  const items: NormalizedItem[] = raw.filter(passesFilters).slice(0, 160);

  return (
    <AppShell
      fullBleed
      container="full"
      className="pt-2"
      title="Calendar — Live News"
      subtitle={<span className="text-slate-400">Source: Macro Headlines (RSS)</span>}
    >
      <div className="relative pl-6 md:pl-9">
        <div className="pointer-events-none absolute left-2 md:left-3 top-0 h-full w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

        {items.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">
            No headlines matched your filters in the last refresh window.
          </p>
        ) : (
          <ul className="space-y-4 pr-3">
            {items.map((it: NormalizedItem) => (
              <li key={it.id} className="relative group">
                {/* Pulsing dot (core + soft halo) */}
                <span className="absolute left-1.5 md:left-2.5 top-4 h-4 w-4 -translate-x-1/2 -translate-y-[3px] rounded-full bg-fuchsia-500/20 blur-[3px] news-pulse" />
                <span
                  className="absolute left-1.5 md:left-2.5 top-4 h-4 w-4 -translate-x-1/2 -translate-y-[3px] rounded-full bg-fuchsia-500/20 blur-[3px] news-pulse"
                  data-news-pulse
                />

                {/* Time chip */}
                <div className="mb-1 pl-1">
                  <time className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 text-xs text-slate-400">
                    {fmtLondon(it.published_at)}
                  </time>
                </div>

                {/* Headline / summary */}
                <div className="rounded-xl px-3 py-2 md:px-4 md:py-2.5 transition-colors hover:bg-white/[0.03]">
                  <div className="text-[15px] md:text-base font-medium leading-snug tracking-tight text-slate-100">
                    {it.title}
                  </div>
                  {it.summary && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
                      {it.summary}
                    </p>
                  )}
                  <div className="mt-2 h-px w-full bg-gradient-to-r from-fuchsia-400/40 via-violet-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-60" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
