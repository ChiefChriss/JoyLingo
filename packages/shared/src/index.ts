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
  /** Start time in seconds (episode-relative). Set by enrichment pipeline. */
  t0?: number;
  /** End time in seconds (episode-relative). Set by enrichment pipeline. */
  t1?: number;
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
  /** How word-level `t0`/`t1` timings were derived. */
  timingSource?: "karaoke" | "proportional" | "mixed";
}

/** Type guard: is this token a word (vs. punctuation)? */
export function isWord(token: Token): token is WordToken {
  return !("punct" in token) || token.punct !== true;
}

// --- Vocabulary & kanji learning -------------------------------------------

/** CJK ideographs + iteration mark — shared by pipeline and client. */
export const KANJI_RE = /[々㐀-䶿一-鿿豈-﫿]/u;

/** Extract unique kanji characters from text, in order of first appearance. */
export function extractKanji(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of text) {
    if (KANJI_RE.test(ch) && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

/** Clip reference for where a word was first or last encountered. */
export interface VocabularyClip {
  episodeId: string;
  lineId: string;
}

/** Tap-logged word in the learner's encounter database (keyed by `dict`). */
export interface VocabularyEntry {
  dict: string;
  reading: string;
  gloss: string | null;
  surface: string;
  tapCount: number;
  mined: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  firstClip: VocabularyClip;
  lastClip: VocabularyClip;
}

export type VocabularyMap = Record<string, VocabularyEntry>;

export type KanjiStatus = "seen" | "learning" | "known";

/** Per-user kanji progress derived from vocabulary encounters. */
export interface KanjiProgress {
  char: string;
  encounterCount: number;
  /** Up to ~5 example lemma keys containing this character. */
  exampleDicts: string[];
  status: KanjiStatus;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type KanjiProgressMap = Record<string, KanjiProgress>;

/** Static reference data for a single kanji (from KANJIDIC). */
export interface KanjiReference {
  char: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  jlpt?: number | null;
  grade?: number | null;
  strokeCount?: number | null;
  frequencyRank?: number | null;
}

/** FSRS-lite scheduling state for a kanji review card. */
export interface KanjiCardState {
  char: string;
  /** Days until next review (0 = due now). */
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

export type KanjiCardMap = Record<string, KanjiCardState>;

// --- User profile & onboarding ----------------------------------------------

/** JLPT goal the onboarding wizard can set. `anime_only` skips JLPT. */
export type JlptGoal = "N5" | "N4" | "N3" | "N2" | "N1" | "anime_only";

/** A favorite anime chosen during onboarding (lightweight catalog row). */
export interface FavoriteAnime {
  malId: number;
  title: string;
  coverImageURL: string | null;
}

/**
 * Device-local user profile. v1 is MVP — no login; keyed by the existing
 * `joylingo:device-id`. Mirrored best-effort to `user_profiles` on the API.
 */
export interface UserProfile {
  onboardingComplete: boolean;
  favoriteAnime: FavoriteAnime[];
  jlptGoal: JlptGoal | null;
  preferredStreamMode: "sub" | "dub";
  kanaBaselineDone: boolean;
}

export const DEFAULT_PROFILE: UserProfile = {
  onboardingComplete: false,
  favoriteAnime: [],
  jlptGoal: null,
  preferredStreamMode: "sub",
  kanaBaselineDone: false,
};

/** Narrow a parsed object into a `UserProfile`, falling back to defaults. */
export function normalizeProfile(input: unknown): UserProfile {
  if (!input || typeof input !== "object") return { ...DEFAULT_PROFILE };
  const p = input as Partial<UserProfile>;
  return {
    onboardingComplete: Boolean(p.onboardingComplete),
    favoriteAnime: Array.isArray(p.favoriteAnime)
      ? p.favoriteAnime
          .map((a) => (a && typeof a === "object" ? a : null))
          .filter((a): a is FavoriteAnime =>
            a !== null &&
            typeof a.malId === "number" &&
            typeof a.title === "string",
          )
          .map((a) => ({
            malId: a.malId,
            title: a.title,
            coverImageURL:
              typeof a.coverImageURL === "string" ? a.coverImageURL : null,
          }))
      : [],
    jlptGoal: p.jlptGoal ?? null,
    preferredStreamMode: p.preferredStreamMode === "dub" ? "dub" : "sub",
    kanaBaselineDone: Boolean(p.kanaBaselineDone),
  };
}

export * from "./curriculum.js";
export * from "./skill-assessment.js";
export * from "./curriculum-fusion.js";
export * from "./edu-sections.js";
