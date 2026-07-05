import type { Episode, Line, Token } from "@joylingo/shared";
import { isWord } from "@joylingo/shared";
import { parseSubtitles, type SubtitleFormat } from "./parse/index.js";
import { getTokenizer, tokenizeLine, TOKENIZER_ID } from "./tokenize/kuromoji.js";
import { alignEnglish } from "./align/en.js";
import { nullGlossProvider, type GlossProvider } from "./gloss/index.js";

export interface EnrichOptions {
  /** Format of the Japanese subtitle input. Default: "srt". */
  format?: SubtitleFormat;
  /** Gloss provider. Default: null provider (glosses become null). */
  gloss?: GlossProvider;
  /** Optional English subtitle content to align onto the lines. */
  english?: { content: string; format?: SubtitleFormat };
  title?: string;
  titleEn?: string | null;
  /** Total duration (s). Defaults to the last line's end time. */
  duration?: number;
  /** ISO timestamp for meta.generatedAt (injectable for deterministic tests). */
  generatedAt?: string;
}

/**
 * The core pipeline: raw Japanese subtitle text → enriched `Episode` JSON
 * matching the client contract in @joylingo/shared.
 */
export async function enrichEpisode(
  japanese: string,
  opts: EnrichOptions = {}
): Promise<Episode> {
  const format = opts.format ?? "srt";
  const gloss = opts.gloss ?? nullGlossProvider;

  const cues = parseSubtitles(japanese, format);
  const tokenizer = await getTokenizer();

  const tokensPerLine: Token[][] = cues.map((cue) => {
    const tokens = tokenizeLine(tokenizer, cue.text);
    for (const tok of tokens) {
      if (isWord(tok)) tok.gloss = gloss.lookup(tok.dict, tok.pos);
    }
    return tokens;
  });

  const englishText = opts.english
    ? alignEnglish(
        cues,
        parseSubtitles(opts.english.content, opts.english.format ?? "srt")
      )
    : null;

  const lines: Line[] = cues.map((cue, i) => ({
    id: `L${i + 1}`,
    start: round(cue.start),
    end: round(cue.end),
    en: englishText ? englishText[i] ?? null : null,
    tokens: tokensPerLine[i]!,
  }));

  const duration = opts.duration ?? (lines.length > 0 ? lines[lines.length - 1]!.end : 0);

  return {
    title: opts.title ?? "Untitled",
    titleEn: opts.titleEn ?? null,
    duration,
    lines,
    meta: {
      source: format,
      tokenizer: TOKENIZER_ID,
      dictionary: gloss.id,
      generatedAt: opts.generatedAt ?? new Date().toISOString(),
    },
  };
}

/** Round to milliseconds to keep the JSON tidy. */
function round(t: number): number {
  return Math.round(t * 1000) / 1000;
}
