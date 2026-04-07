"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";

type DigestRow = {
  id: string;
  analysis_date: string;
  prompt_version: string;
  digest_version: string;
  model: string;
  status: string;
  source_row_count: number;
  digest_text: string | null;
  trade_ideas_text: string | null;
  discord_text: string | null;
  posted_to_discord_at: string | null;
  updated_at: string;
};

type ApiResponse = {
  ok: boolean;
  cached?: boolean;
  error?: string;
  row?: DigestRow;
};

function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-p:my-3 prose-ul:my-2 prose-li:my-1 prose-headings:mb-2 prose-headings:mt-5">
      <ReactMarkdown
        components={{
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-7 text-neutral-200">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 text-sm leading-7 text-neutral-200">{children}</ul>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function CotDigestAdminPanel() {
  const [analysisDate, setAnalysisDate] = React.useState("");
  const [force, setForce] = React.useState(false);
  const [busyGenerate, setBusyGenerate] = React.useState(false);
  const [busyPost, setBusyPost] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cached, setCached] = React.useState<boolean | null>(null);
  const [row, setRow] = React.useState<DigestRow | null>(null);

  async function generateDigest() {
    try {
      setBusyGenerate(true);
      setError(null);

      const res = await fetch("/api/cot/generate-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisDate: analysisDate || undefined,
          force,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!json.ok || !json.row) {
        throw new Error(json.error || "Failed to generate digest");
      }

      setCached(Boolean(json.cached));
      setRow(json.row);
      if (!analysisDate && json.row.analysis_date) {
        setAnalysisDate(json.row.analysis_date);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate digest");
    } finally {
      setBusyGenerate(false);
    }
  }

  async function postToDiscord() {
    try {
      setBusyPost(true);
      setError(null);

      const res = await fetch("/api/cot/post-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisDate: analysisDate || undefined,
          forceGenerate: force,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!json.ok || !json.row) {
        throw new Error(json.error || "Failed to post to Discord");
      }

      setRow(json.row);
      if (!analysisDate && json.row.analysis_date) {
        setAnalysisDate(json.row.analysis_date);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post to Discord");
    } finally {
      setBusyPost(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-neutral-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">COT Digest Admin</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Generate a desk summary from cached analyses, preview it, and post it to Discord.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-neutral-500">
                Analysis date
              </label>
              <input
                type="date"
                value={analysisDate}
                onChange={(e) => setAnalysisDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <p className="mt-2 text-xs text-neutral-500">
                Leave blank to use the latest completed cached analysis date.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="h-4 w-4"
              />
              Force regenerate digest
            </label>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void generateDigest()}
                disabled={busyGenerate}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08] disabled:opacity-50"
              >
                {busyGenerate ? "Generating..." : "Generate digest"}
              </button>

              <button
                type="button"
                onClick={() => void postToDiscord()}
                disabled={busyPost}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                {busyPost ? "Posting..." : "Post to Discord"}
              </button>
            </div>

            {cached !== null && (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-300">
                Last generate result:{" "}
                <span className={cached ? "text-neutral-200" : "text-emerald-300"}>
                  {cached ? "Loaded from cache" : "Freshly generated"}
                </span>
              </div>
            )}

            {row && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-neutral-400">
                <div>Date: {row.analysis_date}</div>
                <div>Model: {row.model}</div>
                <div>Rows used: {row.source_row_count}</div>
                <div>Updated: {new Date(row.updated_at).toLocaleString()}</div>
                <div>
                  Discord posted:{" "}
                  {row.posted_to_discord_at
                    ? new Date(row.posted_to_discord_at).toLocaleString()
                    : "No"}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-sm font-medium text-neutral-300">Digest preview</div>
            {row?.digest_text ? (
              <MarkdownBlock text={row.digest_text} />
            ) : (
              <div className="text-sm text-neutral-500">No digest generated yet.</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 text-sm font-medium text-neutral-300">Discord payload preview</div>
            {row?.discord_text ? (
              <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-200">
                {row.discord_text}
              </pre>
            ) : (
              <div className="text-sm text-neutral-500">No Discord payload yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}