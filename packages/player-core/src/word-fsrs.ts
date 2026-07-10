import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";
import type { KnowledgeEntry } from "./deck.js";

const scheduler = fsrs();

/** JSON-safe FSRS card snapshot stored on KnowledgeEntry. */
export interface StoredFsrsCard {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  elapsed_days: number;
  last_review?: string;
}

const GRADUATE_INTERVAL_DAYS = 21;

export function toFsrsCard(stored: StoredFsrsCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state,
    elapsed_days: stored.elapsed_days,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

export function fromFsrsCard(card: Card): StoredFsrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    elapsed_days: card.elapsed_days,
    last_review: card.last_review?.toISOString(),
  };
}

export function initialWordFsrs(now = new Date()): Pick<KnowledgeEntry, "dueAt" | "lastReviewedAt" | "fsrs"> {
  const card = createEmptyCard(now);
  return {
    dueAt: card.due.toISOString(),
    lastReviewedAt: null,
    fsrs: fromFsrsCard(card),
  };
}

/** Backfill FSRS fields for decks saved before L1. */
export function ensureWordFsrs(entry: KnowledgeEntry, now = new Date()): KnowledgeEntry {
  if (entry.fsrs && entry.dueAt) return entry;
  const seed = initialWordFsrs(now);
  return {
    ...entry,
    dueAt: entry.dueAt ?? seed.dueAt,
    lastReviewedAt: entry.lastReviewedAt ?? seed.lastReviewedAt,
    fsrs: entry.fsrs ?? seed.fsrs,
  };
}

export function isWordDue(entry: KnowledgeEntry, now = Date.now()): boolean {
  if (entry.status === "known") return false;
  const ready = ensureWordFsrs(entry);
  return new Date(ready.dueAt).getTime() <= now;
}

/** Grade with FSRS: Again → Rating.Again, Good → Rating.Good. */
export function gradeWordCard(
  entry: KnowledgeEntry,
  good: boolean,
  now = new Date(),
): KnowledgeEntry {
  const base = ensureWordFsrs(entry, now);
  const result = scheduler.next(toFsrsCard(base.fsrs!), now, good ? Rating.Good : Rating.Again);
  const next = result.card;
  const graduated =
    next.state === State.Review && next.scheduled_days >= GRADUATE_INTERVAL_DAYS;

  return {
    ...base,
    fsrs: fromFsrsCard(next),
    dueAt: next.due.toISOString(),
    lastReviewedAt: now.toISOString(),
    status: graduated ? "known" : "learning",
  };
}
