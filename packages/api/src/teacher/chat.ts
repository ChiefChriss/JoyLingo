import type { EduLessonId } from "@joylingo/shared";
import { buildTeacherSystemPrompt } from "./context.js";
import { streamOpenRouterChat } from "./openrouter.js";
import type { TeacherChatMessage, TeacherMemory } from "./types.js";

const MAX_THREAD_MESSAGES = 12;

export async function* streamTeacherReply(opts: {
  lessonId: EduLessonId;
  messages: TeacherChatMessage[];
  memory: TeacherMemory;
  model?: string;
}): AsyncGenerator<string> {
  const system = await buildTeacherSystemPrompt(opts.lessonId, opts.memory);
  const thread = opts.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_THREAD_MESSAGES);
  if (thread.length === 0) throw new Error("messages required");
  if (thread[thread.length - 1]?.role !== "user") {
    throw new Error("last message must be from the user");
  }
  yield* streamOpenRouterChat(system, thread, opts.model);
}
