import { TtlCache } from "../ttl-cache.js";
import type { TeacherChatMessage, TeacherModelInfo } from "./types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models?output_modalities=text&sort=most-popular";

/** OpenRouter model ids look like `provider/slug` or `provider/slug:variant`. */
const MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/;

const modelsCache = new TtlCache<{
  defaultModel: string;
  models: TeacherModelInfo[];
}>(60 * 60 * 1000);

export function teacherEnabled(): boolean {
  return process.env.TEACHER_ENABLED?.trim().toLowerCase() === "true";
}

export function openRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function defaultModelId(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() ||
    "meta-llama/llama-3.3-70b-instruct"
  );
}

export function isValidModelId(model: string): boolean {
  return MODEL_ID_RE.test(model.trim());
}

function authHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": "https://joylingo.local",
    "X-Title": "JoyLingo Teacher",
  };
}

/**
 * List text chat models from OpenRouter (cached ~1h).
 */
export async function listOpenRouterModels(): Promise<{
  defaultModel: string;
  models: TeacherModelInfo[];
}> {
  return modelsCache.getOrSet("text-models", async () => {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter models failed (${response.status}): ${body.slice(0, 240)}`,
      );
    }
    const json = (await response.json()) as {
      data?: {
        id?: string;
        name?: string;
        context_length?: number;
      }[];
    };
    const models: TeacherModelInfo[] = (json.data ?? [])
      .map((m) => ({
        id: (m.id ?? "").trim(),
        name: (m.name ?? m.id ?? "").trim(),
        contextLength:
          typeof m.context_length === "number" ? m.context_length : undefined,
      }))
      .filter((m) => m.id && isValidModelId(m.id));

    const fallback = defaultModelId();
    if (!models.some((m) => m.id === fallback)) {
      models.unshift({ id: fallback, name: fallback });
    }

    return { defaultModel: fallback, models };
  });
}

/**
 * Stream OpenRouter chat completions as raw content token strings.
 */
export async function* streamOpenRouterChat(
  system: string,
  messages: TeacherChatMessage[],
  model?: string,
): AsyncGenerator<string> {
  const chosen = (model?.trim() || defaultModelId()).trim();
  if (!isValidModelId(chosen)) {
    throw new Error("Invalid model id");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: chosen,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter failed (${response.status}): ${body.slice(0, 240)}`,
    );
  }
  if (!response.body) throw new Error("OpenRouter returned an empty body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const token = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
}
