/**
 * @joylingo/pipeline — backend enrichment pipeline.
 *
 * fetch .srt/.ass → parse → kuromoji tokenize → JMdict gloss → Episode JSON
 * (the shape the client renders; see @joylingo/shared).
 */
export { enrichEpisode, type EnrichOptions } from "./enrich.js";
export {
  parseSubtitles,
  parseSrt,
  parseAss,
  formatFromFilename,
  type Cue,
  type SubtitleFormat,
} from "./parse/index.js";
export { getTokenizer, tokenizeLine, TOKENIZER_ID } from "./tokenize/kuromoji.js";
export { mapPos } from "./tokenize/pos.js";
export {
  resolveGlossProvider,
  JmdictGlossProvider,
  nullGlossProvider,
  DEFAULT_DATA_DIR,
  type GlossProvider,
} from "./gloss/index.js";
export { alignEnglish } from "./align/en.js";

// Re-export the shared contract for convenience.
export type { Episode, Line, Token, WordToken, PunctToken, Pos } from "@joylingo/shared";
