import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/* ========= CONFIG ========= */
const MODEL = process.env.NEWS_MODEL || "gpt-5.4-mini";
const OPENAI_HOST = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const TIMEOUT_MS = Number(process.env.NEWS_OPENAI_TIMEOUT_MS ?? 45000);
const REQUIRE_CLICK = true;

const PROMPT_VERSION = "cot_snapshot_v1";
const CACHE_SOURCE = "cot_snapshot";
const PROCESSING_STALE_MS = 10 * 60 * 1000;
const POLL_MS = 1000;
const POLL_ATTEMPTS = 12;

/* ========= TYPES ========= */
type CalendarEventInput = {
  country?: string | null;
  indicator?: string | null;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  revised?: number | null;
  unit?: string | null;
  releasedAt?: string | null;
};

type CotAnalysisInput = {
  asset?: string;
  code?: string;
  group?: string | null;
  range?: string | null;
  latestDate?: string | null;

  latestNet?: number | null;
  prevNet?: number | null;
  weeklyChange?: number | null;

  longPct?: number | null;
  shortPct?: number | null;
  netPctOi?: number | null;
  openInterest?: number | null;

  largeLong?: number | null;
  largeShort?: number | null;
  grossContracts?: number | null;
  netPctGross?: number | null;

  weeklyLongChange?: number | null;
  weeklyShortChange?: number | null;
  weeklyOiChange?: number | null;

  latestLargeUsd?: number | null;
  latestSmallUsd?: number | null;
  latestCommUsd?: number | null;
  weeklyLargeUsdChange?: number | null;

  indexedReportPrice?: number | null;
  indexedReleasePrice?: number | null;
  reportPrice?: number | null;
  releasePrice?: number | null;
  movePct?: number | null;
  priceDirection?: string | null;
  reactionType?: string | null;
  isFx?: boolean | null;

  netRangePct?: number | null;
  usdRangePct?: number | null;
  oiVsAvgPct?: number | null;

  crossMarket?: {
    peerCount?: number | null;
    confirmationCount?: number | null;
    fadeCount?: number | null;
    strongerPeers?: string[];
    weakerPeers?: string[];
    summary?: string | null;
  } | null;

  peerRanking?: {
    rank?: number | null;
    totalPeers?: number | null;
    score?: number | null;
    positioningScore?: number | null;
    reactionScore?: number | null;
    usdFlowScore?: number | null;
    relativeMoveScore?: number | null;
    strongestPeers?: string[];
    weakestPeers?: string[];
    sideBias?: "long" | "short" | "avoid" | null;
    summary?: string | null;
  } | null;

  syntheticUsd?: {
    included?: boolean | null;
    score?: number | null;
    sideBias?: "long" | "short" | "avoid" | null;
    reactionType?: "confirmation" | "fade" | null;
    summary?: string | null;
  } | null;

  pairIdeas?: {
    topSetups?: Array<{
      pair: string;
      direction: "long" | "short";
      longCode: string;
      shortCode: string;
      scoreGap: number | null;
      rationale: string;
    }>;
    summary?: string | null;
  } | null;

  notes?: string | null;
};

type AnalyzeRequestBody = {
  click?: boolean;
  force?: boolean;
  noStyle?: boolean;

  asset?: string;
  code?: string;
  latestDate?: string | null;
  inputSnapshot?: CotAnalysisInput;

  calendarEvent?: CalendarEventInput;
  testPrompt?: string;
};

type CacheRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  analysis_date: string;
  prompt_version: string;
  model: string;
  source: string;
  status: "processing" | "completed" | "failed";
  input_hash: string;
  prompt_text: string | null;
  result_text: string | null;
  lock_token: string | null;
  locked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type OpenAIMessageChoice = { message?: { content?: string } };
type OpenAIBlockPiece = { text?: string };
type OpenAIBlock = { content?: OpenAIBlockPiece[] };

type OpenAIResponsesJson = {
  output_text?: string;
  output?: OpenAIBlock[];
  choices?: OpenAIMessageChoice[];
  status?: string;
  incomplete_details?: { reason?: string };
} & Record<string, unknown>;

/* ========= HELPERS ========= */
const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

const nstr = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "null" : String(n);

function fmt(v: number | null | undefined, u?: string | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v}${u && u !== "none" ? ` ${u}` : ""}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function normalizeDateInput(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cacheKeyFor(ev: CalendarEventInput, styleTag: "raw" | "styled"): string {
  const parts = [
    "ANALYZE_V3",
    MODEL,
    styleTag,
    (ev.indicator || "").trim(),
    (ev.country || "").trim(),
    (ev.unit || "").trim().toLowerCase(),
    nstr(ev.actual),
    nstr(ev.forecast),
    nstr(ev.previous),
    nstr(ev.revised),
    ev.releasedAt ? new Date(ev.releasedAt).toISOString() : "null",
  ];
  return `ana:${sha1(parts.join("|"))}`;
}

function makePrompt(ev?: CalendarEventInput): string {
  if (!ev) return "Explain what this indicator measures and why it matters to traders.";
  const { indicator, country, actual, forecast, previous, revised, unit } = ev;

  const lines: string[] = [];
  lines.push(`Explain the market significance of: ${indicator ?? "Unknown"} (${country ?? "Global"}).`);
  lines.push("");
  lines.push("Data:");
  lines.push(`• Actual: ${fmt(actual, unit)}`);
  lines.push(`• Forecast: ${fmt(forecast, unit)}`);
  lines.push(`• Previous: ${fmt(previous, unit)}`);
  if (revised != null) lines.push(`• Revised: ${fmt(revised, unit)}`);
  lines.push("");
  lines.push("Instructions:");
  lines.push(
    [
      "- Describe what this indicator measures.",
      "- Compare the actual vs forecast and state if it's better/worse for the economy and local currency.",
      "- Give a clear near-term market read and currency bias.",
      "- Mention typical assets/pairs affected.",
      "- Keep it concise, 3–5 short bullet points. No tables or code fences.",
    ].join("\n")
  );
  return lines.join("\n");
}

function extractText(data: unknown): string {
  if (!isRecord(data)) return "";

  const ot = data["output_text"];
  if (typeof ot === "string" && ot.trim()) return ot.trim();

  const output = data["output"];
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const blk of output) {
      const content = isRecord(blk) ? (blk["content"] as unknown) : undefined;
      if (Array.isArray(content)) {
        for (const piece of content) {
          const txt = isRecord(piece) ? (piece["text"] as unknown) : undefined;
          if (typeof txt === "string" && txt.trim()) parts.push(txt.trim());
        }
      }
    }
    if (parts.length) return parts.join("\n");
  }

  const choices = data["choices"];
  if (Array.isArray(choices) && choices.length) {
    const first = choices[0];
    const msg = isRecord(first) ? (first["message"] as unknown) : undefined;
    const content = isRecord(msg) ? (msg["content"] as unknown) : undefined;
    if (typeof content === "string" && content.trim()) return content.trim();
  }

  return "";
}

function isClearlyTruncated(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/[,:;(\-–—]$/.test(t)) return true;

  const sectionCount = (t.match(/^###\s+/gm) || []).length;
  if (sectionCount > 0 && sectionCount < 4) return true;

  const bulletCount = (t.match(/^[-•]\s+/gm) || []).length;
  if (bulletCount > 0 && bulletCount < 6) return true;

  const lastLine = t.split("\n").filter(Boolean).at(-1) ?? "";
  if (lastLine.length > 0 && lastLine.length < 20 && !/[.!?]$/.test(lastLine)) {
    return true;
  }

  return false;
}

function isStaleProcessingLock(lockedAt?: string | null): boolean {
  if (!lockedAt) return true;
  const t = new Date(lockedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > PROCESSING_STALE_MS;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAI({
  apiKey,
  instructions,
  input,
  maxOutputTokens,
  effort = "low",
  signal,
}: {
  apiKey: string;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  effort?: "low" | "medium" | "high";
  signal: AbortSignal;
}): Promise<OpenAIResponsesJson> {
  const res = await fetch(`${OPENAI_HOST}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      reasoning: { effort },
      store: false,
    }),
    signal,
  });

  const json = (await res.json().catch(() => null)) as OpenAIResponsesJson | null;
  if (!res.ok) {
    const msg = json ? JSON.stringify(json) : "unknown error";
    throw new Error(`LLM ${res.status}: ${msg}`);
  }
  return json ?? {};
}

async function getBusinessCacheRow(params: {
  assetCode: string;
  analysisDate: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("cot_analysis_cache")
    .select("*")
    .eq("asset_code", params.assetCode)
    .eq("analysis_date", params.analysisDate)
    .eq("prompt_version", PROMPT_VERSION)
    .maybeSingle<CacheRow>();

  if (error) throw error;
  return data;
}

async function waitForCompletedCache(params: {
  assetCode: string;
  analysisDate: string;
  expectedInputHash: string;
}) {
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    await sleep(POLL_MS);

    const row = await getBusinessCacheRow({
      assetCode: params.assetCode,
      analysisDate: params.analysisDate,
    });

    if (
      row &&
      row.status === "completed" &&
      row.input_hash === params.expectedInputHash &&
      row.result_text
    ) {
      return row;
    }

    if (row && row.status === "failed") {
      return row;
    }
  }

  return null;
}

async function tryCreateProcessingRow(params: {
  assetCode: string;
  assetName: string;
  analysisDate: string;
  inputHash: string;
  promptText: string;
}) {
  const supabase = getSupabaseAdmin();
  const lockToken = randomUUID();

  const { error } = await supabase.from("cot_analysis_cache").insert({
    asset_code: params.assetCode,
    asset_name: params.assetName,
    analysis_date: params.analysisDate,
    prompt_version: PROMPT_VERSION,
    model: MODEL,
    source: CACHE_SOURCE,
    status: "processing",
    input_hash: params.inputHash,
    prompt_text: params.promptText,
    result_text: null,
    lock_token: lockToken,
    locked_at: new Date().toISOString(),
    last_error: null,
  });

  if (!error) {
    return { acquired: true as const, lockToken };
  }

  return { acquired: false as const, lockToken: null };
}

async function markProcessingRow(params: {
  assetCode: string;
  analysisDate: string;
  assetName: string;
  inputHash: string;
  promptText: string;
}) {
  const supabase = getSupabaseAdmin();
  const lockToken = randomUUID();

  const { error } = await supabase
    .from("cot_analysis_cache")
    .update({
      asset_name: params.assetName,
      model: MODEL,
      source: CACHE_SOURCE,
      status: "processing",
      input_hash: params.inputHash,
      prompt_text: params.promptText,
      result_text: null,
      lock_token: lockToken,
      locked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("asset_code", params.assetCode)
    .eq("analysis_date", params.analysisDate)
    .eq("prompt_version", PROMPT_VERSION);

  if (error) throw error;
  return lockToken;
}

async function saveCompletedRow(params: {
  assetCode: string;
  analysisDate: string;
  assetName: string;
  inputHash: string;
  promptText: string;
  resultText: string;
  lockToken?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("cot_analysis_cache")
    .update({
      asset_name: params.assetName,
      model: MODEL,
      source: CACHE_SOURCE,
      status: "completed",
      input_hash: params.inputHash,
      prompt_text: params.promptText,
      result_text: params.resultText,
      locked_at: null,
      lock_token: null,
      last_error: null,
    })
    .eq("asset_code", params.assetCode)
    .eq("analysis_date", params.analysisDate)
    .eq("prompt_version", PROMPT_VERSION);

  if (params.lockToken) {
    query = query.eq("lock_token", params.lockToken);
  }

  const { error } = await query;
  if (error) throw error;
}

async function saveFailedRow(params: {
  assetCode: string;
  analysisDate: string;
  assetName: string;
  inputHash: string;
  promptText: string;
  errorMessage: string;
  lockToken?: string | null;
}) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("cot_analysis_cache")
    .update({
      asset_name: params.assetName,
      model: MODEL,
      source: CACHE_SOURCE,
      status: "failed",
      input_hash: params.inputHash,
      prompt_text: params.promptText,
      result_text: null,
      last_error: params.errorMessage,
      locked_at: null,
      lock_token: null,
    })
    .eq("asset_code", params.assetCode)
    .eq("analysis_date", params.analysisDate)
    .eq("prompt_version", PROMPT_VERSION);

  if (params.lockToken) {
    query = query.eq("lock_token", params.lockToken);
  }

  const { error } = await query;
  if (error) throw error;
}

/* ========= MAIN HANDLER ========= */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as AnalyzeRequestBody;

    if (REQUIRE_CLICK && body?.click !== true) {
      return new NextResponse(null, { status: 204 });
    }

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Server has no OPENAI_API_KEY" },
        { status: 200 }
      );
    }

    const force = body?.force === true;
    const noStyle = body?.noStyle === true;
    const ev = body?.calendarEvent;
    const testPrompt =
      typeof body?.testPrompt === "string" ? body.testPrompt.trim() : undefined;

    const input = testPrompt || makePrompt(ev);
    const instructions =
      "You are a concise but highly analytical macro and futures positioning strategist. Complete all requested sections. Prefer sharp, trader-relevant interpretation over generic explanation.";

    const styleTag: "raw" | "styled" = noStyle ? "raw" : "styled";

    const assetCode = String(body?.code ?? "").trim().toUpperCase();
    const assetName = String(body?.asset ?? "").trim();
    const analysisDate = normalizeDateInput(body?.latestDate);

    const hasBusinessKeyCache = Boolean(assetCode && assetName && analysisDate);

    const inputHash = hasBusinessKeyCache
      ? sha1(
          stableStringify({
            promptVersion: PROMPT_VERSION,
            styleTag,
            assetCode,
            assetName,
            analysisDate,
            inputSnapshot: body?.inputSnapshot ?? null,
          })
        )
      : sha1(
          stableStringify({
            promptVersion: "ANALYZE_V3",
            model: MODEL,
            styleTag,
            prompt: input,
          })
        );

    if (hasBusinessKeyCache && !force) {
      const existing = await getBusinessCacheRow({
        assetCode,
        analysisDate: analysisDate!,
      });

      if (
        existing &&
        existing.status === "completed" &&
        existing.input_hash === inputHash &&
        existing.result_text
      ) {
        return NextResponse.json(
          { ok: true, model: MODEL, text: existing.result_text, cached: true },
          { status: 200 }
        );
      }

      if (
        existing &&
        existing.status === "processing" &&
        existing.input_hash === inputHash &&
        !isStaleProcessingLock(existing.locked_at)
      ) {
        const waited = await waitForCompletedCache({
          assetCode,
          analysisDate: analysisDate!,
          expectedInputHash: inputHash,
        });

        if (waited?.status === "completed" && waited.result_text) {
          return NextResponse.json(
            { ok: true, model: MODEL, text: waited.result_text, cached: true },
            { status: 200 }
          );
        }
      }
    }

    let lockToken: string | null = null;

    if (hasBusinessKeyCache) {
      const existing = await getBusinessCacheRow({
        assetCode,
        analysisDate: analysisDate!,
      });

      if (!existing) {
        const inserted = await tryCreateProcessingRow({
          assetCode,
          assetName,
          analysisDate: analysisDate!,
          inputHash,
          promptText: input,
        });

        if (inserted.acquired) {
          lockToken = inserted.lockToken;
        } else if (!force) {
          const waited = await waitForCompletedCache({
            assetCode,
            analysisDate: analysisDate!,
            expectedInputHash: inputHash,
          });

          if (waited?.status === "completed" && waited.result_text) {
            return NextResponse.json(
              { ok: true, model: MODEL, text: waited.result_text, cached: true },
              { status: 200 }
            );
          }

          lockToken = await markProcessingRow({
            assetCode,
            assetName,
            analysisDate: analysisDate!,
            inputHash,
            promptText: input,
          });
        } else {
          lockToken = await markProcessingRow({
            assetCode,
            assetName,
            analysisDate: analysisDate!,
            inputHash,
            promptText: input,
          });
        }
      } else {
        lockToken = await markProcessingRow({
          assetCode,
          assetName,
          analysisDate: analysisDate!,
          inputHash,
          promptText: input,
        });
      }
    }

    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TIMEOUT_MS);

    try {
      const attempts: Array<{
        maxOutputTokens: number;
        effort: "low" | "medium";
      }> = [
        { maxOutputTokens: 900, effort: "low" },
        { maxOutputTokens: 1400, effort: "low" },
        { maxOutputTokens: 1800, effort: "medium" },
      ];

      let finalText = "";
      let finalRaw: OpenAIResponsesJson | null = null;
      let gotComplete = false;

      for (const attempt of attempts) {
        const raw = await callOpenAI({
          apiKey,
          instructions,
          input,
          maxOutputTokens: attempt.maxOutputTokens,
          effort: attempt.effort,
          signal: ac.signal,
        });

        const text = extractText(raw);
        const hitCeiling =
          raw?.status === "incomplete" &&
          isRecord(raw?.incomplete_details) &&
          (raw.incomplete_details["reason"] as string | undefined) === "max_output_tokens";

        finalRaw = raw;
        finalText = text;

        if (text && !hitCeiling && !isClearlyTruncated(text)) {
          gotComplete = true;
          break;
        }
      }

      if (!finalText) {
        if (hasBusinessKeyCache) {
          await saveFailedRow({
            assetCode,
            analysisDate: analysisDate!,
            assetName,
            inputHash,
            promptText: input,
            errorMessage: "No model text output",
            lockToken,
          });
        }

        return NextResponse.json(
          { ok: false, error: "No model text output", raw: finalRaw },
          { status: 200 }
        );
      }

      if (!gotComplete) {
        if (hasBusinessKeyCache) {
          await saveFailedRow({
            assetCode,
            analysisDate: analysisDate!,
            assetName,
            inputHash,
            promptText: input,
            errorMessage: "Response may be partial; not cached.",
            lockToken,
          });
        }

        return NextResponse.json(
          {
            ok: true,
            model: MODEL,
            text: finalText,
            cached: false,
            warning: "Response may be partial; not cached.",
          },
          { status: 200 }
        );
      }

      if (hasBusinessKeyCache) {
        await saveCompletedRow({
          assetCode,
          analysisDate: analysisDate!,
          assetName,
          inputHash,
          promptText: input,
          resultText: finalText,
          lockToken,
        });
      }

      return NextResponse.json(
        { ok: true, model: MODEL, text: finalText, cached: false },
        { status: 200 }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";

      if (hasBusinessKeyCache) {
        try {
          await saveFailedRow({
            assetCode,
            analysisDate: analysisDate!,
            assetName,
            inputHash,
            promptText: input,
            errorMessage: message,
            lockToken,
          });
        } catch (saveErr) {
          console.warn("[analyze] failed to persist error state:", saveErr);
        }
      }

      return NextResponse.json({ ok: false, error: message }, { status: 200 });
    } finally {
      clearTimeout(to);
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";

    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}