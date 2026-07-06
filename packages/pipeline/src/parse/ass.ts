import type { Cue } from "./types.js";
import { parseAssKaraoke } from "./ass-karaoke.js";
import { parseTimestamp } from "./srt.js";

/**
 * Parse Advanced SubStation Alpha (.ass/.ssa) Dialogue events into cues.
 *
 * We read the `[Events]` section's `Format:` line to locate the Start, End and
 * Text columns (Text is always last and is the only field allowed to contain
 * commas). Override blocks `{\...}`, drawing commands, and `\N`/`\h` are
 * stripped so the tokenizer only ever sees plain Japanese text.
 */
export function parseAss(input: string): Cue[] {
  const text = stripBom(input).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");

  let inEvents = false;
  let cols: { start: number; end: number; textFrom: number; count: number } | null = null;
  const cues: Cue[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      inEvents = line.toLowerCase() === "[events]";
      continue;
    }
    if (!inEvents) continue;

    if (line.toLowerCase().startsWith("format:")) {
      const names = line
        .slice("format:".length)
        .split(",")
        .map((n) => n.trim().toLowerCase());
      const start = names.indexOf("start");
      const end = names.indexOf("end");
      const textFrom = names.indexOf("text");
      if (start >= 0 && end >= 0 && textFrom >= 0) {
        cols = { start, end, textFrom, count: names.length };
      }
      continue;
    }

    // Only spoken lines. `Comment:` events are authoring notes — skip them.
    if (!line.toLowerCase().startsWith("dialogue:")) continue;
    if (!cols) continue;

    const rest = line.slice("dialogue:".length);
    // Split into (count-1) fields; the remainder (Text) keeps its commas.
    const fields = splitFields(rest, cols.count - 1);
    const startStr = fields[cols.start];
    const endStr = fields[cols.end];
    const textRaw = fields[cols.textFrom];
    if (startStr === undefined || endStr === undefined || textRaw === undefined) continue;

    const start = parseTimestamp(startStr.trim());
    const end = parseTimestamp(endStr.trim());
    const clean = cleanAssText(textRaw);
    if (clean === "") continue;

    const charTimings = parseAssKaraoke(textRaw, start);
    cues.push({
      start,
      end,
      text: clean,
      ...(charTimings ? { charTimings } : {}),
    });
  }

  return cues;
}

/**
 * Split into exactly `maxSplits` commas, so the final field (Text) retains any
 * commas it contains. Returns `maxSplits + 1` fields.
 */
function splitFields(s: string, maxSplits: number): string[] {
  const out: string[] = [];
  let idx = 0;
  for (let n = 0; n < maxSplits; n++) {
    const comma = s.indexOf(",", idx);
    if (comma === -1) break;
    out.push(s.slice(idx, comma));
    idx = comma + 1;
  }
  out.push(s.slice(idx));
  return out;
}

function cleanAssText(raw: string): string {
  let t = raw;
  // Drawing mode: {\p1}...{\p0} contains vector coords, not text — drop the run.
  t = t.replace(/\{[^}]*\\p[1-9][^}]*\}[^{]*(\{[^}]*\\p0[^}]*\})?/g, "");
  // Any remaining override blocks: {\i1}, {\an8}, {\pos(...)}
  t = t.replace(/\{[^}]*\}/g, "");
  // Hard line break \N, soft \n, hard space \h
  t = t.replace(/\\N/g, " ").replace(/\\n/g, " ").replace(/\\h/g, " ");
  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
