import type { CharTiming } from "./types.js";

/**
 * Parse ASS dialogue text with `\k`/`\K` karaoke tags into per-character timings.
 * Returns `undefined` when no karaoke tags are present.
 */
export function parseAssKaraoke(rawText: string, lineStart: number): CharTiming[] | undefined {
  if (!/\\[kK][fo]?\d+/i.test(rawText)) return undefined;

  const timings: CharTiming[] = [];
  let cursorCs = 0;
  let pendingCs: number | null = null;
  let i = 0;

  const flushText = (text: string) => {
    if (!text || pendingCs === null) return;
    const durationCs = pendingCs;
    pendingCs = null;
    const chars = [...text];
    if (chars.length === 0) return;
    const perCharCs = durationCs / chars.length;
    for (const ch of chars) {
      const start = lineStart + cursorCs / 100;
      cursorCs += perCharCs;
      timings.push({
        char: ch,
        start: round(start),
        end: round(lineStart + cursorCs / 100),
      });
    }
  };

  while (i < rawText.length) {
    if (rawText[i] === "{") {
      const end = rawText.indexOf("}", i);
      if (end === -1) break;
      const block = rawText.slice(i + 1, end);
      for (const m of block.matchAll(/\\[kK][fo]?(\d+)/gi)) {
        pendingCs = parseInt(m[1]!, 10);
      }
      i = end + 1;
      continue;
    }
    if (rawText.startsWith("\\N", i)) {
      flushText(" ");
      i += 2;
      continue;
    }
    if (rawText.startsWith("\\n", i)) {
      flushText(" ");
      i += 2;
      continue;
    }
    if (rawText.startsWith("\\h", i)) {
      flushText(" ");
      i += 2;
      continue;
    }
    let j = i;
    while (j < rawText.length) {
      if (rawText[j] === "{") break;
      if (rawText.startsWith("\\N", j) || rawText.startsWith("\\n", j) || rawText.startsWith("\\h", j)) {
        break;
      }
      j++;
    }
    flushText(rawText.slice(i, j));
    i = j;
  }

  return timings.length > 0 ? timings : undefined;
}

function round(t: number): number {
  return Math.round(t * 1000) / 1000;
}
