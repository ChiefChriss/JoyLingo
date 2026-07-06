/** Per-character timing within a subtitle cue (from ASS karaoke tags). */
export interface CharTiming {
  char: string;
  start: number;
  end: number;
}

/** A single subtitle cue, normalized across formats. Times are in seconds. */
export interface Cue {
  start: number;
  end: number;
  /** Plain text, override/markup tags stripped, internal line breaks -> spaces. */
  text: string;
  /** Populated when ASS `\k` karaoke tags are present in the source. */
  charTimings?: CharTiming[];
}

export type SubtitleFormat = "srt" | "ass" | "vtt";
