import type { Cue } from "./types.js";

/**
 * Parse SubRip (.srt) — and, leniently, WebVTT (.vtt) — into cues.
 *
 * SRT timestamps look like `00:01:02,500`; VTT uses `.` for the millisecond
 * separator and may carry cue settings after the end time. We accept both.
 */
export function parseSrt(input: string): Cue[] {
  const text = stripBom(input).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;

    // A leading numeric index line is optional (VTT often omits it).
    let i = 0;
    if (lines[i] !== undefined && /^\d+$/.test(lines[i]!.trim())) i++;

    const timing = lines[i];
    if (timing === undefined) continue;
    const times = parseTimingLine(timing);
    if (!times) continue; // "WEBVTT" header, NOTE blocks, etc.
    i++;

    const body = lines.slice(i).join("\n");
    const clean = cleanText(body);
    if (clean === "") continue;

    cues.push({ start: times.start, end: times.end, text: clean });
  }

  return cues;
}

function parseTimingLine(line: string): { start: number; end: number } | null {
  // 00:01:02,500 --> 00:01:05,000  (SRT)  or  00:01:02.500 --> ... (VTT, + settings)
  const m = line.match(
    /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/
  );
  if (!m) return null;
  return { start: parseTimestamp(m[1]!), end: parseTimestamp(m[2]!) };
}

/** "00:01:02,500" | "00:01:02.5" -> seconds. */
export function parseTimestamp(ts: string): number {
  const [hms, frac = "0"] = ts.split(/[.,]/);
  const parts = hms!.split(":").map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0]!, parts[1]!];
  const ms = Number((frac + "000").slice(0, 3)); // normalize to 3 digits
  return h! * 3600 + m! * 60 + s! + ms / 1000;
}

function cleanText(raw: string): string {
  return (
    raw
      // HTML/font tags: <i>, <b>, <font ...>, </font>
      .replace(/<[^>]+>/g, "")
      // ASS-style override blocks sometimes leak into srt: {\an8}, {\i1}
      .replace(/\{[^}]*\}/g, "")
      // Collapse internal newlines and whitespace runs into a single space
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
