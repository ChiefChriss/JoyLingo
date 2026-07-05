import type { Cue } from "../parse/index.js";

interface Interval {
  start: number;
  end: number;
}

/** Temporal overlap (seconds) between two intervals; 0 if disjoint. */
function overlap(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * Align an English subtitle track onto the Japanese lines by time overlap.
 *
 * Japanese and English rips rarely share cue boundaries, so for each Japanese
 * line we collect every English cue that overlaps it in time and join them in
 * order. Returns one entry per input line (`null` when nothing overlaps).
 */
export function alignEnglish(jpLines: Interval[], enCues: Cue[]): (string | null)[] {
  const sorted = [...enCues].sort((a, b) => a.start - b.start);

  return jpLines.map((line) => {
    const hits = sorted
      .filter((c) => overlap(line, c) > 0)
      .sort((a, b) => a.start - b.start);
    if (hits.length === 0) return null;

    // De-dupe repeated captions and join.
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const c of hits) {
      if (!seen.has(c.text)) {
        seen.add(c.text);
        parts.push(c.text);
      }
    }
    return parts.join(" ");
  });
}
