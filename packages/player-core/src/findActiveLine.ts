import type { Line } from "@joylingo/shared";

/**
 * Find the subtitle line active at time `t` (seconds), or null.
 *
 * Binary search over lines sorted by `start` — episodes can have hundreds
 * of cues polled ~4x/sec, so a linear scan per tick adds up. Intervals are
 * half-open `[start, end)` so adjacent cues sharing a boundary never both
 * match (no first-match flicker at the seam).
 */
export function findActiveLine(lines: Line[], t: number): Line | null {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const line = lines[mid]!; // mid is always within [lo, hi] ⊆ valid indices
    if (t < line.start) {
      hi = mid - 1;
    } else if (t >= line.end) {
      lo = mid + 1;
    } else {
      return line;
    }
  }
  return null;
}
