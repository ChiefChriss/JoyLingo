/** Compact per-lesson teacher memory (localStorage). */
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

const MAX_SUMMARIES = 10;
const MAX_TOPICS = 24;
const MAX_SUMMARY_CHARS = 280;

function storageKey(lessonId: string): string {
  return `joylingo:teacher-memory:${lessonId}`;
}

function emptyMemory(lessonId: string): TeacherMemory {
  return {
    lessonId,
    coveredTopics: [],
    askSummaries: [],
    updatedAt: Date.now(),
  };
}

function truncate(text: string, max = MAX_SUMMARY_CHARS): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function loadTeacherMemory(lessonId: string): TeacherMemory {
  try {
    const raw = localStorage.getItem(storageKey(lessonId));
    if (!raw) return emptyMemory(lessonId);
    const parsed = JSON.parse(raw) as TeacherMemory;
    if (parsed.lessonId !== lessonId) return emptyMemory(lessonId);
    return {
      lessonId,
      coveredTopics: Array.isArray(parsed.coveredTopics)
        ? parsed.coveredTopics.slice(0, MAX_TOPICS)
        : [],
      askSummaries: Array.isArray(parsed.askSummaries)
        ? parsed.askSummaries.slice(-MAX_SUMMARIES)
        : [],
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return emptyMemory(lessonId);
  }
}

export function saveTeacherMemory(memory: TeacherMemory): void {
  localStorage.setItem(
    storageKey(memory.lessonId),
    JSON.stringify({ ...memory, updatedAt: Date.now() }),
  );
}

/** Record a finished Q&A and optionally a topic label into compact memory. */
export function rememberExchange(
  lessonId: string,
  question: string,
  answer: string,
  topic?: string,
): TeacherMemory {
  const memory = loadTeacherMemory(lessonId);
  memory.askSummaries = [
    ...memory.askSummaries,
    {
      q: truncate(question, 160),
      a: truncate(answer),
      at: Date.now(),
    },
  ].slice(-MAX_SUMMARIES);

  const label = topic?.trim() || inferTopic(question);
  if (label) {
    const next = [label, ...memory.coveredTopics.filter((t) => t !== label)];
    memory.coveredTopics = next.slice(0, MAX_TOPICS);
  }
  memory.updatedAt = Date.now();
  saveTeacherMemory(memory);
  return memory;
}

function inferTopic(question: string): string | null {
  const q = question.trim().replace(/\s+/g, " ");
  if (q.length < 3) return null;
  return truncate(q, 48);
}

export function teacherUiEnabled(): boolean {
  return import.meta.env.VITE_TEACHER_ENABLED === "true";
}

export function teacherVoiceEnabled(): boolean {
  return (
    teacherUiEnabled() && import.meta.env.VITE_TEACHER_VOICE === "true"
  );
}

const MODEL_STORAGE_KEY = "joylingo:teacher-model";

export function loadTeacherModel(): string | null {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function saveTeacherModel(modelId: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, modelId.trim());
  } catch {
    // ignore quota / private mode
  }
}
