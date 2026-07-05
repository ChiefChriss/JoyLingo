/** A single subtitle cue, normalized across formats. Times are in seconds. */
export interface Cue {
  start: number;
  end: number;
  /** Plain text, override/markup tags stripped, internal line breaks -> spaces. */
  text: string;
}

export type SubtitleFormat = "srt" | "ass" | "vtt";
