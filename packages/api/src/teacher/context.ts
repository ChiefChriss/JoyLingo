import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  EDU_LESSON_BY_ID,
  type CurriculumWord,
  type EduLessonId,
} from "@joylingo/shared";
import { getCurriculumWords } from "../curriculum-match.js";
import type { TeacherMemory } from "./types.js";

const MAX_LESSON_CHARS = 12_000;
const MAX_VOCAB = 80;

export async function loadLessonMarkdown(lessonId: EduLessonId): Promise<string> {
  const lesson = EDU_LESSON_BY_ID[lessonId];
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  const path = fileURLToPath(
    new URL(`../../../web/public/curriculum/${lesson.file}`, import.meta.url),
  );
  const md = await readFile(path, "utf8");
  if (md.length <= MAX_LESSON_CHARS) return md;
  return `${md.slice(0, MAX_LESSON_CHARS)}\n\n[…lesson truncated for context…]`;
}

function formatVocab(words: CurriculumWord[]): string {
  if (words.length === 0) return "(no vocab table for this lesson)";
  return words
    .slice(0, MAX_VOCAB)
    .map((w) => `- ${w.surface}（${w.reading}）— ${w.gloss}`)
    .join("\n");
}

function formatMemory(memory: TeacherMemory): string {
  const topics =
    memory.coveredTopics.length > 0
      ? memory.coveredTopics.map((t) => `- ${t}`).join("\n")
      : "- (none yet)";
  const asks =
    memory.askSummaries.length > 0
      ? memory.askSummaries
          .slice(-10)
          .map((s) => `Q: ${s.q}\nA: ${s.a}`)
          .join("\n\n")
      : "(none yet)";
  return `Topics already covered with this student:\n${topics}\n\nRecent Q&A summaries:\n${asks}`;
}

export async function buildTeacherSystemPrompt(
  lessonId: EduLessonId,
  memory: TeacherMemory,
): Promise<string> {
  const lesson = EDU_LESSON_BY_ID[lessonId];
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  const [markdown, words] = await Promise.all([
    loadLessonMarkdown(lessonId),
    getCurriculumWords(lessonId),
  ]);

  return `You are JoyLingo's Japanese curriculum teacher for ONE lesson only.

Lesson ${lesson.id}: ${lesson.title} (${lesson.titleJa})
Source: ${lesson.source} · JLPT band: ${lesson.jlpt}

Rules:
- Stay on this lesson's material. If asked about unrelated Japanese, briefly redirect to this lesson.
- Prefer clear, short explanations suitable for self-study.
- When explaining words, include reading (furigana/romaji as helpful) and gloss.
- For pronunciation questions, show the kana reading split into mora (beats) with middle dots and give the total. Count ん and small っ as one mora each, and count both parts of a long vowel separately (for example, がっこう = が・っ・こ・う = 4 mora).
- Pitch accent cannot be inferred reliably from spelling. Only give a Tokyo Japanese high/low or downstep pattern when you are confident; otherwise say that the pitch pattern needs verification instead of inventing one.
- End pronunciation answers with one short kana-only line in the form "Speak: ..." so local Japanese TTS can read it cleanly.
- When lesson vocabulary has matching clips, remind the student that "Hear it in your anime" demonstrates the word at natural speed and in context.
- Use the student's covered topics and prior Q&A so you do not repeat yourself unnecessarily.
- If you are unsure, say so. Do not invent grammar rules.
- Answer in English unless the student asks for Japanese, or when giving example sentences.

=== LESSON CONTENT ===
${markdown}

=== LESSON VOCAB (sample) ===
${formatVocab(words)}

=== STUDENT MEMORY FOR THIS LESSON ===
${formatMemory(memory)}`;
}

/** Spoken-session instructions for Hugging Face speech-to-speech realtime mode. */
export async function buildTeacherVoicePrompt(
  lessonId: EduLessonId,
  memory: TeacherMemory,
): Promise<string> {
  const base = await buildTeacherSystemPrompt(lessonId, memory);
  return `${base}

=== VOICE MODE ===
You are in a live spoken conversation (Hugging Face speech-to-speech).
- Keep replies short: usually 1–3 sentences, then pause for the student.
- The student may switch between English and Japanese mid-utterance — follow their language mix naturally.
- Speak Japanese examples clearly; briefly gloss in English when helpful.
- Do not use markdown, bullet lists, or "Speak:" lines — this will be read aloud by TTS.
`;
}
