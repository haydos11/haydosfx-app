import type { AnalyzeRequest, AnalyzeResponse } from "./types";

export async function callExistingAnalyze(params: {
  origin: string;
  prompt: string;
  force?: boolean;
}) {
  const body: AnalyzeRequest = {
    click: true,
    force: Boolean(params.force),
    noStyle: true,
    testPrompt: params.prompt,
  };

  const res = await fetch(`${params.origin}/api/news/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as Partial<AnalyzeResponse>;

  if (!res.ok || !json.ok) {
    throw new Error(
      json.error ||
        `Analyze request failed with status ${res.status}. Response: ${JSON.stringify(json)}`
    );
  }

  const text = String(json.text ?? "").trim();

  if (!text) {
    throw new Error(
      `No model text output. Response: ${JSON.stringify(json)}`
    );
  }

  return {
    text,
    cached: Boolean(json.cached),
  };
}