import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeIdeaText, type TradeDirection } from "@/lib/fx/symbols";

export const runtime = "nodejs";

export const ANALYSIS_PROMPT_VERSION = "cot_snapshot_v1";
export const DIGEST_VERSION = "cot_digest_v1";
export const DIGEST_MODEL =
  process.env.COT_DIGEST_MODEL ||
  process.env.NEWS_MODEL ||
  "gpt-5.4-mini";

const OPENAI_HOST = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const TIMEOUT_MS = Number(process.env.COT_DIGEST_TIMEOUT_MS ?? 60000);

export type CachedAnalysisRow = {
  id: string;
  asset_code: string;
  asset_name: string;
  analysis_date: string;
  prompt_version: string;
  model: string;
  status: "processing" | "completed" | "failed";
  input_hash: string;
  result_text: string | null;
  updated_at: string;
  source: string | null;
};

export type DigestRow = {
  id: string;
  analysis_date: string;
  prompt_version: string;
  digest_version: string;
  model: string;
  status: "processing" | "completed" | "failed";
  source_row_count: number;
  input_hash: string;
  source_summary: unknown;
  digest_text: string | null;
  trade_ideas_text: string | null;
  discord_text: string | null;
  posted_to_discord_at: string | null;
  discord_response: unknown;
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

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
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

async function callOpenAI({
  apiKey,
  instructions,
  input,
  signal,
}: {
  apiKey: string;
  instructions: string;
  input: string;
  signal: AbortSignal;
}): Promise<string> {
  const res = await fetch(`${OPENAI_HOST}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DIGEST_MODEL,
      instructions,
      input,
      max_output_tokens: 2200,
      reasoning: { effort: "medium" },
      store: false,
    }),
    signal,
  });

  const json = (await res.json().catch(() => null)) as OpenAIResponsesJson | null;
  if (!res.ok) {
    throw new Error(
      `LLM ${res.status}: ${json ? JSON.stringify(json) : "unknown error"}`
    );
  }

  const text = extractText(json ?? {});
  if (!text) throw new Error("No digest text returned from model");
  return text.trim();
}

export async function getLatestAnalysisDate(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cot_analysis_cache")
    .select("analysis_date")
    .eq("status", "completed")
    .eq("prompt_version", ANALYSIS_PROMPT_VERSION)
    .order("analysis_date", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.analysis_date ?? null;
}

export async function getCompletedAnalysesForDate(analysisDate: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cot_analysis_cache")
    .select(
      "id, asset_code, asset_name, analysis_date, prompt_version, model, status, input_hash, result_text, updated_at, source"
    )
    .eq("analysis_date", analysisDate)
    .eq("status", "completed")
    .eq("prompt_version", ANALYSIS_PROMPT_VERSION)
    .order("asset_code", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CachedAnalysisRow[];
}

export async function getDigestRow(analysisDate: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cot_analysis_digest")
    .select("*")
    .eq("analysis_date", analysisDate)
    .eq("prompt_version", ANALYSIS_PROMPT_VERSION)
    .eq("digest_version", DIGEST_VERSION)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as DigestRow | null;
}

function splitDigestSections(fullText: string) {
  const lines = fullText.split(/\r?\n/);
  const tradeIdeaStart = lines.findIndex((line) =>
    /^###\s+(best trade ideas|trade ideas)/i.test(line.trim())
  );

  if (tradeIdeaStart === -1) {
    return {
      digestText: fullText.trim(),
      tradeIdeasText: "",
    };
  }

  const tradeLines: string[] = [];
  for (let i = tradeIdeaStart; i < lines.length; i += 1) {
    tradeLines.push(lines[i]);
  }

  return {
    digestText: fullText.trim(),
    tradeIdeasText: tradeLines.join("\n").trim(),
  };
}

function buildDiscordText(analysisDate: string, fullText: string) {
  const header = `**Weekly FX Positioning Digest — ${analysisDate}**`;
  const body = fullText.trim();
  return `${header}\n\n${body}`;
}

function normalizeTradeIdeaLine(line: string): string {
  const match = line.match(
    /^(\s*[-•]\s*)(Long|Short)\s+([A-Za-z]{6})(\s+—\s+.*)?$/i
  );

  if (!match) return line;

  const prefix = match[1] ?? "- ";
  const rawSide = (match[2] ?? "").toLowerCase();
  const rawSymbol = (match[3] ?? "").toUpperCase();
  const suffix = match[4] ?? "";

  if (rawSide !== "long" && rawSide !== "short") {
    return line;
  }

  const normalized = normalizeIdeaText(
    rawSymbol,
    rawSide as TradeDirection
  );

  const side = normalized.direction === "long" ? "Long" : "Short";
  return `${prefix}${side} ${normalized.symbol}${suffix}`;
}

function normalizeDigestTradeIdeaLines(fullText: string): string {
  const lines = fullText.split(/\r?\n/);
  let inTradeIdeas = false;

  return lines
    .map((line) => {
      const trimmed = line.trim();

      if (
        /^###\s+best trade ideas/i.test(trimmed) ||
        /^###\s+trade ideas/i.test(trimmed)
      ) {
        inTradeIdeas = true;
        return line;
      }

      if (/^###\s+/i.test(trimmed)) {
        inTradeIdeas = false;
        return line;
      }

      if (!inTradeIdeas) return line;

      return normalizeTradeIdeaLine(line);
    })
    .join("\n");
}

export async function generateDigest({
  analysisDate,
  force = false,
}: {
  analysisDate?: string;
  force?: boolean;
}) {
  const dateToUse = analysisDate ?? (await getLatestAnalysisDate());
  if (!dateToUse) {
    throw new Error("No completed cached analyses found yet.");
  }

  const rows = await getCompletedAnalysesForDate(dateToUse);
  if (!rows.length) {
    throw new Error(`No completed cached analyses found for ${dateToUse}.`);
  }

  const inputHash = sha1(
    stableStringify({
      analysisDate: dateToUse,
      promptVersion: ANALYSIS_PROMPT_VERSION,
      digestVersion: DIGEST_VERSION,
      rows: rows.map((row) => ({
        asset_code: row.asset_code,
        input_hash: row.input_hash,
        updated_at: row.updated_at,
      })),
    })
  );

  const existing = await getDigestRow(dateToUse);
  if (
    !force &&
    existing &&
    existing.status === "completed" &&
    existing.input_hash === inputHash &&
    existing.digest_text
  ) {
    return { row: existing, cached: true as const };
  }

  const compactRows = rows.map((row) => ({
    asset_code: row.asset_code,
    asset_name: row.asset_name,
    source: row.source ?? null,
    analysis: row.result_text ?? "",
  }));

  const instructions = [
    "You are a senior macro FX strategist writing an internal desk digest.",
    "Use only the provided cached per-currency analyses.",
    "Do not invent data or mention missing currencies unless the evidence is present.",
    "Prioritise tradeable ideas, cross-currency relative value, crowding risks, and broad USD implications.",
    "",
    "Write the output in these exact sections:",
    "### Broad desk view",
    "### Strongest currencies",
    "### Weakest currencies",
    "### Best trade ideas",
    "### Risks / crowded trades",
    "### Trading takeaway",
    "",
    "Rules:",
    "- Keep it sharp and institutional.",
    "- 10 to 16 bullets total.",
    "- Best trade ideas should name 3 to 5 setups using standard FX notation.",
    "- Always use conventional market pair ordering, for example NZDCAD not CADNZD.",
    "- If the directional idea implies the reversed market symbol, flip Long/Short accordingly.",
    "- Mention when a trade is crowded or better as relative-value rather than outright USD.",
    "- Do not use tables.",
  ].join("\n");

  const input = [
    `Analysis date: ${dateToUse}`,
    `Prompt version: ${ANALYSIS_PROMPT_VERSION}`,
    "",
    "Cached analyses JSON:",
    "```json",
    JSON.stringify(compactRows, null, 2),
    "```",
  ].join("\n");

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const rawText = await callOpenAI({
      apiKey,
      instructions,
      input,
      signal: ac.signal,
    });

    const fullText = normalizeDigestTradeIdeaLines(rawText);
    const { digestText, tradeIdeasText } = splitDigestSections(fullText);
    const discordText = buildDiscordText(dateToUse, fullText);

    const payload = {
      analysis_date: dateToUse,
      prompt_version: ANALYSIS_PROMPT_VERSION,
      digest_version: DIGEST_VERSION,
      model: DIGEST_MODEL,
      status: "completed",
      source_row_count: rows.length,
      input_hash: inputHash,
      source_summary: {
        asset_codes: rows.map((r) => r.asset_code),
        row_count: rows.length,
      },
      digest_text: digestText,
      trade_ideas_text: tradeIdeasText,
      discord_text: discordText,
      last_error: null,
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("cot_analysis_digest")
      .upsert(payload, {
        onConflict: "analysis_date,prompt_version,digest_version",
      })
      .select("*")
      .single();

    if (error) throw error;

    return { row: data as DigestRow, cached: false as const };
  } finally {
    clearTimeout(to);
  }
}

function chunkDiscordMessage(text: string, maxLen = 1800) {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let current = "";
  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (para.length <= maxLen) {
      current = para;
      continue;
    }

    let remaining = para;
    while (remaining.length > maxLen) {
      chunks.push(remaining.slice(0, maxLen));
      remaining = remaining.slice(maxLen);
    }
    current = remaining;
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function postDigestToDiscord({
  analysisDate,
  forceGenerate = false,
}: {
  analysisDate?: string;
  forceGenerate?: boolean;
}) {
  const webhookUrl = process.env.DISCORD_WEEKLY_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("Missing DISCORD_WEEKLY_WEBHOOK_URL");
  }

  const { row } = await generateDigest({
    analysisDate,
    force: forceGenerate,
  });

  if (!row.discord_text) {
    throw new Error("Digest has no Discord text to post.");
  }

  const parts = chunkDiscordMessage(row.discord_text);
  const responses: Array<{ ok: boolean; status: number }> = [];

  for (const content of parts) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    responses.push({ ok: res.ok, status: res.status });

    if (!res.ok) {
      throw new Error(`Discord webhook failed with status ${res.status}`);
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cot_analysis_digest")
    .update({
      posted_to_discord_at: new Date().toISOString(),
      discord_response: { parts: responses },
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as DigestRow;
}