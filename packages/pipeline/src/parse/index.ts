import { parseSrt } from "./srt.js";
import { parseAss } from "./ass.js";
import type { Cue, SubtitleFormat } from "./types.js";

export type { Cue, SubtitleFormat } from "./types.js";
export { parseSrt } from "./srt.js";
export { parseAss } from "./ass.js";

/** Infer subtitle format from a filename extension. */
export function formatFromFilename(filename: string): SubtitleFormat {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "ass":
    case "ssa":
      return "ass";
    case "vtt":
      return "vtt";
    case "srt":
    default:
      return "srt";
  }
}

/** Parse a subtitle string using an explicit or filename-inferred format. */
export function parseSubtitles(input: string, format: SubtitleFormat): Cue[] {
  const cues = format === "ass" ? parseAss(input) : parseSrt(input);
  // Sort by start and drop zero/negative-duration cues that some rips include.
  return cues
    .filter((c) => c.end > c.start && c.text.length > 0)
    .sort((a, b) => a.start - b.start);
}
