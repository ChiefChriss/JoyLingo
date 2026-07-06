import type { Line, Token } from "@joylingo/shared";
import { isWord } from "@joylingo/shared";
import type { CharTiming } from "../parse/types.js";

function round(t: number): number {
  return Math.round(t * 1000) / 1000;
}

function assignProportional(
  tok: { t0?: number; t1?: number },
  charStart: number,
  charEnd: number,
  totalChars: number,
  lineStart: number,
  duration: number,
): void {
  if (totalChars <= 0 || duration <= 0) {
    tok.t0 = lineStart;
    tok.t1 = round(lineStart + duration);
    return;
  }
  tok.t0 = round(lineStart + (charStart / totalChars) * duration);
  tok.t1 = round(lineStart + (charEnd / totalChars) * duration);
}

/**
 * Assign `t0`/`t1` (episode-relative seconds) to word tokens in a line.
 * Uses karaoke char timings when available, otherwise proportional fallback.
 */
export function alignTokenTimings(
  tokens: Token[],
  lineStart: number,
  lineEndSec: number,
  charTimings?: CharTiming[],
): "karaoke" | "proportional" {
  const chars = tokens.flatMap((t) => [...t.s]);
  const totalChars = chars.length;
  const duration = lineEndSec - lineStart;
  let usedKaraoke = false;

  let charOffset = 0;
  for (const tok of tokens) {
    if (!isWord(tok)) {
      charOffset += [...tok.s].length;
      continue;
    }
    const len = [...tok.s].length;
    const charStart = charOffset;
    const charEnd = charOffset + len;

    if (charTimings && charTimings.length >= charEnd) {
      const slice = charTimings.slice(charStart, charEnd);
      if (slice.length > 0) {
        tok.t0 = slice[0]!.start;
        tok.t1 = slice[slice.length - 1]!.end;
        usedKaraoke = true;
        charOffset += len;
        continue;
      }
    }

    assignProportional(tok, charStart, charEnd, totalChars, lineStart, duration);
    charOffset += len;
  }

  return usedKaraoke ? "karaoke" : "proportional";
}

/** Apply token timings to all lines; returns aggregate timing source. */
export function alignEpisodeTimings(
  lines: Line[],
  cues: { start: number; end: number; charTimings?: CharTiming[] }[],
): "karaoke" | "proportional" | "mixed" {
  let karaoke = 0;
  let proportional = 0;
  for (let i = 0; i < lines.length; i++) {
    const cue = cues[i];
    if (!cue) continue;
    const mode = alignTokenTimings(lines[i]!.tokens, cue.start, cue.end, cue.charTimings);
    if (mode === "karaoke") karaoke++;
    else proportional++;
  }
  if (karaoke > 0 && proportional > 0) return "mixed";
  if (karaoke > 0) return "karaoke";
  return "proportional";
}
