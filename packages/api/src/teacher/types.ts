/** Compact per-lesson teacher memory (not a full chat transcript). */
export interface TeacherAskSummary {
  q: string;
  a: string;
  at: number;
}

export interface TeacherMemory {
  lessonId: string;
  coveredTopics: string[];
  askSummaries: TeacherAskSummary[];
  updatedAt: number;
}

export interface TeacherChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TeacherModelInfo {
  id: string;
  name: string;
  contextLength?: number;
}

export interface TeacherChatRequest {
  lessonId: string;
  threadId?: string;
  /** OpenRouter model id; falls back to OPENROUTER_MODEL / default. */
  model?: string;
  messages: TeacherChatMessage[];
  memory: TeacherMemory;
}
