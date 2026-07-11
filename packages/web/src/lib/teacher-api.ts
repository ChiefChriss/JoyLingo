import { apiUrl } from "./api-base.js";
import { getDeviceId } from "./vocabulary.js";
import type { TeacherChatMessage, TeacherMemory } from "./teacher-memory.js";

export type { TeacherChatMessage };

export interface TeacherModelInfo {
  id: string;
  name: string;
  contextLength?: number;
}

export interface TeacherModelsResponse {
  defaultModel: string;
  models: TeacherModelInfo[];
}

export interface StreamTeacherOptions {
  lessonId: string;
  threadId?: string;
  model?: string;
  messages: TeacherChatMessage[];
  memory: TeacherMemory;
  signal?: AbortSignal;
  onToken: (text: string) => void;
}

/** Fetch available OpenRouter text models for the teacher selector. */
export async function fetchTeacherModels(
  signal?: AbortSignal,
): Promise<TeacherModelsResponse> {
  const res = await fetch(apiUrl("/api/teacher/models"), {
    headers: {
      "x-joylingo-device-id": getDeviceId(),
      accept: "application/json",
    },
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load models (${res.status})`);
  }
  return (await res.json()) as TeacherModelsResponse;
}

/** Stream a teacher reply over SSE from POST /api/teacher/chat. */
export async function streamTeacherChat(
  opts: StreamTeacherOptions,
): Promise<void> {
  const res = await fetch(apiUrl("/api/teacher/chat"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": getDeviceId(),
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      lessonId: opts.lessonId,
      threadId: opts.threadId,
      model: opts.model,
      messages: opts.messages,
      memory: opts.memory,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Teacher request failed (${res.status})`);
  }
  if (!res.body) throw new Error("Teacher stream was empty");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n");
    buffer = chunks.pop() ?? "";

    for (const line of chunks) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      if (eventName === "token") {
        const text = (data as { text?: string }).text;
        if (text) opts.onToken(text);
      } else if (eventName === "error") {
        throw new Error(
          (data as { error?: string }).error ?? "Teacher stream error",
        );
      }
      eventName = "message";
    }
  }
}

/** Fetch spoken-session instructions for Hugging Face speech-to-speech. */
export async function fetchTeacherVoiceSession(opts: {
  lessonId: string;
  memory: TeacherMemory;
  model?: string;
  signal?: AbortSignal;
}): Promise<{ instructions: string; sampleRateHz: number; model: string }> {
  const res = await fetch(apiUrl("/api/teacher/voice-session"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": getDeviceId(),
      accept: "application/json",
    },
    body: JSON.stringify({
      lessonId: opts.lessonId,
      memory: opts.memory,
      model: opts.model,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Voice session failed (${res.status})`);
  }
  return (await res.json()) as {
    instructions: string;
    sampleRateHz: number;
    model: string;
  };
}

/** Keep the voice sidecar LLM proxy on the same model as the text selector. */
export async function setTeacherVoiceModel(model: string): Promise<void> {
  const res = await fetch(apiUrl("/api/teacher/voice-model"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": getDeviceId(),
      accept: "application/json",
    },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to set voice model (${res.status})`);
  }
}
