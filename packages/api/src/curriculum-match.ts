/**
 * Match curriculum vocabulary to tokenized subtitle clips in favorite-anime episodes.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Episode, Line, WordToken } from "@joylingo/shared";
import {
  fusionVocabLessonId,
  glossOverlapScore,
  wordsForLesson,
  type ClipCandidate,
  type CurriculumWord,
  type EduLessonId,
  isWord,
} from "@joylingo/shared";
import type { DB } from "./db.js";
import { listEnrichedEpisodesByMalIds } from "./db.js";

const GLOSS_THRESHOLD = 0.5;
const CLIP_PAD = 0.3;
const MAX_PER_WORD = 3;

let vocabCache: CurriculumWord[] | null = null;

export async function loadVocabIndex(): Promise<CurriculumWord[]> {
  if (vocabCache) return vocabCache;
  const refPath = fileURLToPath(
    new URL("../../web/public/curriculum/vocab-index.json", import.meta.url),
  );
  const raw = await readFile(refPath, "utf8");
  vocabCache = JSON.parse(raw) as CurriculumWord[];
  return vocabCache;
}

function lineText(line: Line): string {
  return line.tokens.map((t) => t.s).join("");
}

function timingSource(episode: Episode, token: WordToken): "karaoke" | "proportional" {
  if (token.t0 != null && episode.meta?.timingSource === "karaoke") return "karaoke";
  if (token.t0 != null && episode.meta?.timingSource === "mixed") return "karaoke";
  return "proportional";
}

function clipBounds(line: Line, token: WordToken): { clipStart: number; clipEnd: number } {
  const t0 = token.t0 ?? line.start;
  const t1 = token.t1 ?? line.end;
  return {
    clipStart: Math.max(0, round(t0 - CLIP_PAD)),
    clipEnd: round(t1 + CLIP_PAD),
  };
}

function round(t: number): number {
  return Math.round(t * 1000) / 1000;
}

function tokenMatches(word: CurriculumWord, token: WordToken): number {
  if (word.dict && token.dict === word.dict) {
    const glossScore = glossOverlapScore(word.gloss, token.gloss);
    return glossScore >= GLOSS_THRESHOLD ? glossScore : glossScore > 0 ? glossScore : 0.7;
  }
  const reading = token.r ?? token.s;
  if (reading === word.reading || token.s === word.surface) {
    const glossScore = glossOverlapScore(word.gloss, token.gloss);
    if (glossScore >= GLOSS_THRESHOLD) return glossScore;
    if (glossScore > 0) return glossScore;
    return 0.55;
  }
  return 0;
}

function scanEpisode(
  word: CurriculumWord,
  episodeId: string,
  episodeTitle: string,
  episode: Episode,
  playCount: number,
): (ClipCandidate & { playCount: number; duration: number })[] {
  const hits: (ClipCandidate & { playCount: number; duration: number })[] = [];

  for (const line of episode.lines) {
    for (const tok of line.tokens) {
      if (!isWord(tok)) continue;
      const score = tokenMatches(word, tok);
      if (score < GLOSS_THRESHOLD) continue;
      const { clipStart, clipEnd } = clipBounds(line, tok);
      hits.push({
        curriculumWordId: word.id,
        episodeId,
        episodeTitle,
        lineId: line.id,
        dict: tok.dict,
        surface: tok.s,
        gloss: tok.gloss,
        contextJa: lineText(line),
        contextEn: line.en,
        clipStart,
        clipEnd,
        matchScore: score,
        timingSource: timingSource(episode, tok),
        playCount,
        duration: clipEnd - clipStart,
      });
    }
  }

  return hits;
}

export async function matchCurriculumClips(
  db: DB,
  lessonId: EduLessonId,
  malIds: number[],
): Promise<ClipCandidate[]> {
  const vocabLessonId = fusionVocabLessonId(lessonId);
  if (!vocabLessonId) return [];
  const index = await loadVocabIndex();
  const words = wordsForLesson(index, vocabLessonId);
  return matchWordsToClips(db, words, malIds);
}

/** Scan favorite-anime episodes for clips matching arbitrary word targets (mined deck, etc.). */
export async function matchWordsToClips(
  db: DB,
  words: CurriculumWord[],
  malIds: number[],
): Promise<ClipCandidate[]> {
  if (words.length === 0 || malIds.length === 0) return [];

  const episodes = await listEnrichedEpisodesByMalIds(db, malIds);
  const byWord = new Map<string, (ClipCandidate & { playCount: number; duration: number })[]>();

  for (const word of words) {
    const candidates: (ClipCandidate & { playCount: number; duration: number })[] = [];
    for (const ep of episodes) {
      candidates.push(...scanEpisode(word, ep.id, ep.title, ep.enriched, ep.playCount));
    }
    candidates.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (a.duration !== b.duration) return a.duration - b.duration;
      return b.playCount - a.playCount;
    });
    byWord.set(word.id, candidates.slice(0, MAX_PER_WORD));
  }

  return [...byWord.values()].flat().map(({ playCount: _p, duration: _d, ...c }) => c);
}

export async function getCurriculumWords(lessonId: EduLessonId): Promise<CurriculumWord[]> {
  const vocabLessonId = fusionVocabLessonId(lessonId);
  if (!vocabLessonId) return [];
  const index = await loadVocabIndex();
  return wordsForLesson(index, vocabLessonId);
}
