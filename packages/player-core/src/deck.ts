import type { Episode, Line, WordToken, VocabularyClip, VocabularyEntry } from "@joylingo/shared";
import { isWord } from "@joylingo/shared";
import { initialWordFsrs } from "./word-fsrs.js";

/**
 * In-memory word knowledge, keyed by dictionary form. Shared by web and
 * (later) mobile; Phase 5 replaces the map with Postgres + FSRS state.
 */
export type KnowledgeStatus = "learning" | "known";

export interface KnowledgeEntry {
  status: KnowledgeStatus;
  reading: string;
  gloss: string | null;
  surface: string;
  /** Full Japanese line the word was mined from. */
  context: string;
  contextEn: string | null;
  /** ISO timestamp when the card is next due (FSRS). */
  dueAt: string;
  lastReviewedAt: string | null;
  /** Serialized FSRS card state — see word-fsrs.ts. */
  fsrs?: import("./word-fsrs.js").StoredFsrsCard;
}

export type KnowledgeMap = Record<string, KnowledgeEntry>;

export interface DeckCard extends KnowledgeEntry {
  dict: string;
}

/** Clip reference for review — may omit bounds when resolved on player load. */
export interface ReviewClipRef {
  episodeId: string;
  lineId: string;
  clipStart?: number;
  clipEnd?: number;
}

export interface ReviewDeckCard extends DeckCard {
  /** Most recent encounter — primary replay target. */
  clip?: ReviewClipRef;
  /** First encounter when it differs from lastClip. */
  firstClip?: ReviewClipRef;
  lastClip?: ReviewClipRef;
}

/** Resolve karaoke/line bounds for a vocabulary clip ref when episode JSON is loaded. */
export function resolveVocabularyClipRef(
  ref: VocabularyClip,
  dict: string,
  episode: Episode | null | undefined,
): ReviewClipRef {
  const base: ReviewClipRef = { episodeId: ref.episodeId, lineId: ref.lineId };
  if (!episode) return base;
  const bounds = wordClipBounds(episode, ref.lineId, dict);
  return bounds ? { ...base, ...bounds } : base;
}

function clipsMatch(a: VocabularyClip, b: VocabularyClip): boolean {
  return a.episodeId === b.episodeId && a.lineId === b.lineId;
}

/** Attach firstClip / lastClip refs for word review replay. */
export function attachWordReviewClips(
  card: DeckCard,
  vocab: VocabularyEntry | undefined,
  episode: Episode | null | undefined,
  currentEpisodeId: string,
): ReviewDeckCard {
  if (!vocab) return card;

  const episodeFor = (ref: VocabularyClip) =>
    ref.episodeId === currentEpisodeId ? episode : null;

  const last = resolveVocabularyClipRef(vocab.lastClip, card.dict, episodeFor(vocab.lastClip));
  const first = resolveVocabularyClipRef(vocab.firstClip, card.dict, episodeFor(vocab.firstClip));
  const same = clipsMatch(vocab.firstClip, vocab.lastClip);

  return {
    ...card,
    clip: last,
    lastClip: last,
    firstClip: same ? undefined : first,
  };
}

/** Render a line's surface text (for context strings and transcripts). */
export function lineText(line: Line): string {
  return line.tokens.map((t) => t.s).join("");
}

/** Build the KnowledgeEntry for mining a word out of a line. */
export function mineEntry(tok: WordToken, line: Line): KnowledgeEntry {
  return {
    status: "learning",
    reading: tok.r ?? tok.s,
    gloss: tok.gloss,
    surface: tok.s,
    context: lineText(line),
    contextEn: line.en,
    ...initialWordFsrs(),
  };
}

export function toDeck(knowledge: KnowledgeMap): DeckCard[] {
  return Object.entries(knowledge).map(([dict, entry]) => ({ dict, ...entry }));
}

const CLIP_PAD = 0.3;

/** Karaoke or line-level clip bounds for a mined word on a loaded episode. */
export function wordClipBounds(
  episode: Episode,
  lineId: string,
  dict: string,
): { clipStart: number; clipEnd: number } | null {
  const line = episode.lines.find((l) => l.id === lineId);
  if (!line) return null;
  for (const tok of line.tokens) {
    if (!isWord(tok) || tok.dict !== dict) continue;
    const t0 = tok.t0 ?? line.start;
    const t1 = tok.t1 ?? line.end;
    return {
      clipStart: Math.max(0, round(t0 - CLIP_PAD)),
      clipEnd: round(t1 + CLIP_PAD),
    };
  }
  return {
    clipStart: Math.max(0, round(line.start - CLIP_PAD)),
    clipEnd: round(line.end + CLIP_PAD),
  };
}

function round(t: number): number {
  return Math.round(t * 1000) / 1000;
}
