import type { Pos } from "@joylingo/shared";

/**
 * Looks up an English gloss for a dictionary-form word. Implementations are
 * swappable (JMdict now; a user's custom dictionary or a cache later).
 */
export interface GlossProvider {
  /** Dictionary identifier recorded in Episode.meta.dictionary. */
  readonly id: string;
  /**
   * @param dict dictionary (lemma) form of the word
   * @param pos  our display POS, used to disambiguate homographs
   * @returns gloss string (senses joined with "; ") or null if not found
   */
  lookup(dict: string, pos: Pos): string | null;
}

/** Fallback used when no dictionary is available — every lookup returns null. */
export const nullGlossProvider: GlossProvider = {
  id: "none",
  lookup: () => null,
};
