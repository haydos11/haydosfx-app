import { NextRequest, NextResponse } from "next/server";
import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/* ========= CONFIG ========= */
const MODEL = process.env.NEWS_MODEL || "gpt-5-nano";
const OPENAI_HOST = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const TIMEOUT_MS = Number(process.env.NEWS_OPENAI_TIMEOUT_MS ?? 45000);
const REQUIRE_CLICK = true;

/* ========= SUPABASE (OPTIONAL CACHE) ========= */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const hasSupabase = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

/* ========= HELPERS ========= */
type CalendarEventInput = {
  country?: string | null;
  indicator?: string | null;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  revised?: number | null;
  unit?: string | null;
  releasedAt?: string | null; // ISO if you have it
};

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

const nstr = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "null" : String(n);

function fmt(v: number | null | undefined, u?: string | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v}${u && u !== "none" ? ` ${u}` : ""}`;
}

/** SMART CACHE KEY (includes values so new results miss cache automatically) */
function cacheKeyFor(ev: CalendarEventInput, styleTag: "raw" | "styled"): string {
  const parts = [
    MODEL,
    styleTag, // <- separate caches by style mode
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
      "- Give a clear near-term market read (risk-on/off) and currency bias.",
      "- Mention typical assets/pairs affected (e.g., USD/JPY, equities, yields).",
      "- Keep it concise, 3–5 short bullet points. No tables or code fences.",
    ].join("\n")
  );
  return lines.join("\n");
}

/* ---- Type guards + response shape for OpenAI Responses API variants ---- */
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractText(data: unknown): string {
  if (!isRecord(data)) return "";

  // 1) unified output_text
  const ot = data["output_text"];
  if (typeof ot === "string" && ot.trim()) return ot.trim();

  // 2) structured "output" array with content blocks
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

  // 3) chat-style choices[0].message.content
  const choices = data["choices"];
  if (Array.isArray(choices) && choices.length) {
    const first = choices[0];
    const msg = isRecord(first) ? (first["message"] as unknown) : undefined;
    const content = isRecord(msg) ? (msg["content"] as unknown) : undefined;
    if (typeof content === "string" && content.trim()) return content.trim();
  }

  return "";
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
      reasoning: { effort }, // keep reasoning budget light
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

/* ========= MAIN HANDLER ========= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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

    const force: boolean = body?.force === true;
    const noStyle: boolean = body?.noStyle === true; // <-- Option A flag from client
    const ev: CalendarEventInput | undefined = body?.calendarEvent;

    // Accept free-text mode from drawer via `testPrompt`
    const testPrompt: string | undefined =
      typeof body?.testPrompt === "string" ? body.testPrompt : undefined;

    // Build model input
    const input = testPrompt || makePrompt(ev);
    const instructions =
      "You are a concise macro/markets analyst for traders. Focus on actionable interpretation, not definitions.";

    // Style tag (for cache separation)
    const styleTag: "raw" | "styled" = noStyle ? "raw" : "styled";

    // Cache key
    const key = testPrompt
      ? `ana:${sha1(`${MODEL}|${styleTag}|${input}`)}`
      : ev
      ? cacheKeyFor(ev, styleTag)
      : `ana:${sha1(`${MODEL}|${styleTag}|${input}`)}`;

    // Serve from cache unless force is true
    if (!force && hasSupabase && supabase) {
      try {
        const { data: hit } = await supabase
          .from("ai_cache")
          .select("result")
          .eq("id", key)
          .maybeSingle();
        if (hit?.result) {
          return NextResponse.json(
            { ok: true, model: MODEL, text: hit.result, cached: true },
            { status: 200 }
          );
        }
      } catch (e) {
        console.warn("[analyze] cache read failed:", e);
      }
    }

    // OpenAI call with timeout & retry on ceiling
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), TIMEOUT_MS);

    try {
      let raw = await callOpenAI({
        apiKey,
        instructions,
        input,
        maxOutputTokens: 800,
        effort: "low",
        signal: ac.signal,
      });
      let text = extractText(raw);

      const hitCeiling =
        raw?.status === "incomplete" &&
        isRecord(raw?.incomplete_details) &&
        (raw.incomplete_details["reason"] as string | undefined) === "max_output_tokens";

      if (!text && hitCeiling) {
        raw = await callOpenAI({
          apiKey,
          instructions,
          input,
          maxOutputTokens: 1500,
          effort: "low",
          signal: ac.signal,
        });
        text = extractText(raw);
      }

      if (!text) {
        return NextResponse.json(
          { ok: false, error: "No model text output", raw },
          { status: 200 }
        );
      }

      // OPTION A: Always return RAW model text (no server-side stylizing)
      const payloadText = text;

      // write-through cache
      if (hasSupabase && supabase) {
        try {
          await supabase.from("ai_cache").upsert({
            id: key,
            model: MODEL,
            prompt: input,
            result: payloadText,
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("[analyze] cache write failed:", e);
        }
      }

      return NextResponse.json(
        { ok: true, model: MODEL, text: payloadText, cached: false },
        { status: 200 }
      );
    } finally {
      clearTimeout(to);
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
