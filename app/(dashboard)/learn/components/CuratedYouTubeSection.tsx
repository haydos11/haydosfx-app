import React from "react";
import VideoCard from "./VideoCard";
import { learnStartHere, YOUTUBE_CHANNEL_URL } from "../data";

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-4">
      {/* larger dot */}
      <span className="relative flex h-3.5 w-3.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white/20" />
        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white/80" />
      </span>

      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold tracking-[0.22em] text-white/80">
          STEP {n}
        </span>
        <span className="text-sm uppercase tracking-[0.18em] text-white/45">
          {text}
        </span>
      </div>
    </div>
  );
}

function Rail() {
  return (
    <div className="relative hidden md:block">
      <div className="absolute left-1/2 top-2 h-[calc(100%-8px)] w-px -translate-x-1/2 bg-white/10" />
      <div className="absolute left-1/2 top-[18%] h-px w-4 -translate-x-1/2 bg-white/10" />
      <div className="absolute left-1/2 top-[50%] h-px w-4 -translate-x-1/2 bg-white/10" />
      <div className="absolute left-1/2 top-[82%] h-px w-4 -translate-x-1/2 bg-white/10" />

      <div className="absolute left-1/2 top-[10%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white/70 shadow-[0_0_0_6px_rgba(255,255,255,0.06)]" />
      <div className="absolute left-1/2 top-[42%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white/50 shadow-[0_0_0_6px_rgba(255,255,255,0.05)]" />
      <div className="absolute left-1/2 top-[74%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white/40 shadow-[0_0_0_6px_rgba(255,255,255,0.04)]" />
    </div>
  );
}

export default function CuratedYouTubeSection() {
  const { title, subtitle, featured, videos } = learnStartHere;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/60" />
          <p className="text-sm text-white/70">Learning</p>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {title}
        </h1>

        <p className="max-w-2xl text-sm text-white/70 md:text-base">
          {subtitle}
        </p>

        <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
          <span>Structure</span>
          <span className="text-white/20">→</span>
          <span>Control</span>
          <span className="text-white/20">→</span>
          <span>Liquidity</span>
        </div>
      </div>

      {/* Rail + Content */}
      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-[28px_1fr]">
        <Rail />

        <div className="space-y-12">
          {/* STEP 1 */}
          <div className="space-y-4">
            <StepLabel n={1} text="Support & Resistance" />

            {/* Key fix: consistent width, not a multi-column grid */}
            <div className="w-full max-w-5xl">
              <VideoCard video={featured} />
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* STEP 2 */}
          <div className="space-y-4">
            <StepLabel n={2} text="Market Structure" />

            <div className="w-full max-w-4xl">
              <VideoCard video={videos[0]} />
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* STEP 3 */}
          <div className="space-y-4">
            <StepLabel n={3} text="Session Flow & Liquidity" />

            <div className="w-full max-w-4xl">
              <VideoCard video={videos[1]} />
            </div>
          </div>

          {/* Footer CTA */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-white">Want more like this?</p>
                <p className="text-sm text-white/70">
                  This is the curated foundation track — no fluff. Full library is on YouTube.
                </p>
              </div>

              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                View the channel
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}