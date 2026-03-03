"use client";

import React from "react";
import type { CuratedVideo } from "@/app/(dashboard)/learn/components/types";

function ytThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

function ytEmbed(id: string) {
  // no-cookie embed + minimal related content
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

function ytWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

export default function VideoCard({
  video,
  featured = false,
}: {
  video: CuratedVideo;
  featured?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [thumbSrc, setThumbSrc] = React.useState(ytThumb(video.id));

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition",
        "hover:border-white/20 hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative h-full w-full text-left"
            aria-label={`Play video: ${video.title}`}
          >
            <img
              src={thumbSrc}
              alt={video.title}
              className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:opacity-100 group-hover:scale-[1.02]"
              loading="lazy"
              onError={() =>
                setThumbSrc(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`)
              }
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />

            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              {video.level && <Badge>{video.level}</Badge>}
              {video.duration && <Badge>{video.duration}</Badge>}
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/35 px-5 py-2.5 backdrop-blur">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 18V6l12 6-12 6Z"
                      fill="currentColor"
                      className="text-white"
                    />
                  </svg>
                </span>
                <span className="text-sm font-medium text-white">Watch</span>
              </div>
            </div>

            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <span className="text-xs text-white/70">Click to load</span>
              <span className="text-xs text-white/50">YouTube embed</span>
            </div>
          </button>
        ) : (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={ytEmbed(video.id)}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-white">{video.title}</h3>

          <a
            href={ytWatchUrl(video.id)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label={`Open on YouTube: ${video.title}`}
          >
            Open
          </a>
        </div>

        {video.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-white/70">
            {video.description}
          </p>
        ) : null}

        {video.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {video.tags.slice(0, 4).map((t: string) => (
              <span
                key={t}
                className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}