import type { Line, WordToken } from "@joylingo/shared";

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
}

export type KnowledgeMap = Record<string, KnowledgeEntry>;

export interface DeckCard extends KnowledgeEntry {
  dict: string;
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
  };
}

export function toDeck(knowledge: KnowledgeMap): DeckCard[] {
  return Object.entries(knowledge).map(([dict, entry]) => ({ dict, ...entry }));
}
