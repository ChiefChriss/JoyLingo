import { describe, it, expect } from "vitest";
import { parseAssKaraoke } from "../src/parse/ass-karaoke.js";
import { parseAss } from "../src/parse/ass.js";

describe("parseAssKaraoke", () => {
  it("extracts per-character timings from \\k tags", () => {
    const raw = "{\\k50}わ{\\k40}た{\\k60}し";
    const timings = parseAssKaraoke(raw, 10);
    expect(timings).toHaveLength(3);
    expect(timings![0]).toEqual({ char: "わ", start: 10, end: 10.5 });
    expect(timings![1]).toEqual({ char: "た", start: 10.5, end: 10.9 });
    expect(timings![2]).toEqual({ char: "し", start: 10.9, end: 11.5 });
  });

  it("returns undefined when no karaoke tags", () => {
    expect(parseAssKaraoke("こんにちは", 0)).toBeUndefined();
  });
});

describe("parseAss with karaoke", () => {
  it("attaches charTimings to cues", () => {
    const ass = [
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      "Dialogue: 0,0:00:10.00,0:00:12.00,Default,,0,0,0,,{\\k50}わ{\\k50}た",
    ].join("\n");
    const cues = parseAss(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.text).toBe("わた");
    expect(cues[0]!.charTimings).toHaveLength(2);
  });
});
