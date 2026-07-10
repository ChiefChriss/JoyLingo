/** Curriculum × immersion fusion types shared by API and web. */
import type { EduLessonId } from "./skill-assessment.js";

export interface CurriculumWord {
  id: string;
  lessonId: EduLessonId;
  surface: string;
  reading: string;
  gloss: string;
  dict: string | null;
}

export interface ClipCandidate {
  curriculumWordId: string;
  episodeId: string;
  episodeTitle: string;
  lineId: string;
  dict: string;
  surface: string;
  gloss: string | null;
  contextJa: string;
  contextEn: string | null;
  clipStart: number;
  clipEnd: number;
  matchScore: number;
  timingSource: "karaoke" | "proportional";
}

export type FusionCardStatus = "learning" | "known";

export interface FusionCard {
  id: string;
  curriculumWordId: string;
  dict: string;
  reading: string;
  glossExpected: string;
  surface: string;
  contextJa: string;
  contextEn: string | null;
  episodeId: string;
  lineId: string;
  clipStart: number;
  clipEnd: number;
  timingSource: "karaoke" | "proportional";
  status: FusionCardStatus;
  intervalDays: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
}

export type FusionCardMap = Record<string, FusionCard>;

/**
 * Vocab index lesson that powers clip matching on each edu lesson page.
 * Grammar lessons (02, 04, 06) reuse the vocab list from their Genki/Tobira pair.
 */
const FUSION_VOCAB_SOURCE: Partial<Record<EduLessonId, EduLessonId>> = {
  "02": "03",
  "03": "03",
  "04": "05",
  "05": "05",
  "06": "05",
};

export function fusionVocabLessonId(lessonId: EduLessonId): EduLessonId | null {
  return FUSION_VOCAB_SOURCE[lessonId] ?? null;
}

export function lessonSupportsFusion(lessonId: EduLessonId): boolean {
  return fusionVocabLessonId(lessonId) != null;
}

/** Load words for a lesson from the static vocab index. */
export function wordsForLesson(
  index: CurriculumWord[],
  lessonId: EduLessonId,
): CurriculumWord[] {
  return index.filter((w) => w.lessonId === lessonId);
}

/** Split gloss strings into comparable tokens. */
export function glossTokens(gloss: string): string[] {
  return gloss
    .toLowerCase()
    .split(/[;,/()]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Score 0–1 overlap between curriculum gloss and subtitle token gloss. */
export function glossOverlapScore(expected: string, actual: string | null): number {
  if (!actual) return 0;
  const a = glossTokens(expected);
  const b = glossTokens(actual);
  if (a.length === 0 || b.length === 0) return 0;
  let hits = 0;
  for (const token of a) {
    if (b.some((g) => g.includes(token) || token.includes(g))) hits++;
  }
  return hits / a.length;
}
