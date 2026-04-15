"use client";

import { BarChart3, Brain, LayoutPanelTop, Sparkles } from "lucide-react";
import RiskSentimentLab from "./components/RiskSentimentLab";

function SummaryTile({
  label,
  value,
  note,
  icon,
  tone = "border-white/10 bg-white/[0.03]",
}: {
  label: string;
  value: string;
  note?: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">
          {label}
        </div>
        {icon ? <div className="text-neutral-300">{icon}</div> : null}
      </div>
      <div className="text-lg font-semibold tracking-tight text-white">{value}</div>
      {note ? <div className="mt-1 text-xs leading-5 text-neutral-400">{note}</div> : null}
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm text-neutral-400">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function AdminSentimentLabPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%),rgba(255,255,255,0.02)]">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
            <Sparkles size={12} />
            <span>Sentiment Lab</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Risk sentiment design and AI interpretation workspace
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-400">
            Iterate on the risk ladder, signal hierarchy, AI narrative, and trade-read
            presentation here without affecting the live dashboard.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryTile
              label="Purpose"
              value="Design iteration"
              note="Refine visual hierarchy and readability."
              icon={<LayoutPanelTop size={14} />}
              tone="border-sky-500/20 bg-sky-500/10"
            />
            <SummaryTile
              label="Signal Model"
              value="Risk ladder"
              note="Compact, scan-first layout with regime context."
              icon={<BarChart3 size={14} />}
              tone="border-emerald-500/20 bg-emerald-500/10"
            />
            <SummaryTile
              label="AI Layer"
              value="Enabled"
              note="Generate desk read and trade ideas from the ladder."
              icon={<Brain size={14} />}
              tone="border-violet-500/20 bg-violet-500/10"
            />
            <SummaryTile
              label="Safe Mode"
              value="Admin only"
              note="Main dashboard remains untouched while you iterate."
              icon={<Sparkles size={14} />}
              tone="border-amber-500/20 bg-amber-500/10"
            />
          </div>
        </div>
      </section>

      <SectionShell
        title="Risk Sentiment Lab"
        subtitle="Full-width experimental view for layout, interaction, and AI-guided interpretation."
      >
        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <RiskSentimentLab />
          </div>
        </div>
      </SectionShell>
    </div>
  );
}