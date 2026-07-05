/**
 * @joylingo/shared — the JSON contract shared by the enrichment pipeline,
 * the backend, and the client (web + React Native).
 *
 * The pipeline produces `Episode` objects; the client renders them and never
 * tokenizes Japanese itself. Keep this file the single source of truth for the
 * shape — the prototype (immersion_player_prototype.jsx) hand-wrote data that
 * matches these types.
 */

/**
 * Short part-of-speech codes used by the client for the dictionary card and
 * (later) study filters. Kuromoji's native POS is Japanese and far more
 * granular; the pipeline maps it down to this stable, display-friendly set.
 */
export type Pos =
  | "noun"
  | "pronoun"
  | "verb"
  | "adj-i" // 形容詞 — i-adjective
  | "adj-na" // 形容動詞 — na-adjective
  | "adv"
  | "particle"
  | "auxiliary" // 助動詞 (だ/です/た … as a bound auxiliary)
  | "copula" // だ/です when standing as the copula
  | "conj"
  | "interj"
  | "prefix"
  | "suffix"
  | "counter"
  | "expr" // set phrase / expression
  | "unknown";

/**
 * One renderable unit inside a subtitle line.
 *
 * Two variants:
 *  - a punctuation/symbol token carries only `s` (+ `punct: true`);
 *  - a word token carries the full lookup payload.
 */
export type Token = PunctToken | WordToken;

export interface PunctToken {
  /** Surface text as it appears on screen. */
  s: string;
  punct: true;
}

export interface WordToken {
  /** Surface form as it appears in the line (may be conjugated). */
  s: string;
  /**
   * Furigana reading in hiragana. `null` when the surface has no kanji
   * (pure kana / romaji needs no reading), so the client can skip <ruby>.
   */
  r: string | null;
  /** Dictionary (lemma) form — the key for the deck and word-knowledge map. */
  dict: string;
  /** English gloss(es), joined with "; ". `null` when no dictionary entry matched. */
  gloss: string | null;
  /** Display POS code. */
  pos: Pos;
  punct?: false;
}

export interface Line {
  /** Stable id within the episode, e.g. "L1". */
  id: string;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** English translation of the line, if an English track was aligned. */
  en: string | null;
  tokens: Token[];
}

export interface Episode {
  title: string;
  titleEn: string | null;
  /** Total duration in seconds if known (else the last line's end). */
  duration: number;
  lines: Line[];
  /** Provenance / build metadata — not consumed by the renderer. */
  meta?: EpisodeMeta;
}

export interface EpisodeMeta {
  /** Source subtitle format the Japanese track was parsed from. */
  source: "srt" | "ass" | "vtt";
  /** Tokenizer + dictionary versions, for cache-busting enriched JSON. */
  tokenizer: string;
  dictionary: string;
  /** ISO timestamp of when the JSON was generated. */
  generatedAt: string;
}

/** Type guard: is this token a word (vs. punctuation)? */
export function isWord(token: Token): token is WordToken {
  return !("punct" in token) || token.punct !== true;
}
