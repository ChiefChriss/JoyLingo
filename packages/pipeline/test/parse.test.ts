import { describe, it, expect } from "vitest";
import { parseSrt } from "../src/parse/srt.js";
import { parseAss } from "../src/parse/ass.js";
import { parseSubtitles } from "../src/parse/index.js";

describe("parseSrt", () => {
  it("parses blocks, timestamps, and strips tags", () => {
    const srt = [
      "1",
      "00:00:00,500 --> 00:00:04,000",
      "あ、<i>電車</i>が来た。",
      "",
      "2",
      "00:00:04,500 --> 00:00:07,500",
      "急いで!",
      "遅れるよ!",
      "",
    ].join("\n");

    const cues = parseSrt(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 0.5, end: 4.0, text: "あ、電車が来た。" });
    // multi-line cue collapses to a single space
    expect(cues[1]!.text).toBe("急いで! 遅れるよ!");
    expect(cues[1]!.start).toBeCloseTo(4.5);
  });

  it("tolerates a BOM and CRLF line endings", () => {
    const srt = "﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nテスト\r\n";
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.text).toBe("テスト");
  });

  it("accepts VTT-style timestamps without an index line", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nこんにちは\n";
    const cues = parseSrt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual({ start: 1.0, end: 2.5, text: "こんにちは" });
  });
});

describe("parseAss", () => {
  const ass = [
    "[Script Info]",
    "Title: Test",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname",
    "Style: Default,Arial",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    "Dialogue: 0,0:00:00.50,0:00:04.00,Default,,0,0,0,,あ、{\\i1}電車{\\i0}が来た。",
    "Dialogue: 0,0:00:04.50,0:00:07.50,Default,,0,0,0,,急いで!\\N遅れるよ!",
    "Comment: 0,0:00:08.00,0:00:09.00,Default,,0,0,0,,this is a note",
  ].join("\n");

  it("reads Dialogue events using the Format column order", () => {
    const cues = parseAss(ass);
    expect(cues).toHaveLength(2); // Comment line ignored
    expect(cues[0]).toEqual({ start: 0.5, end: 4.0, text: "あ、電車が来た。" });
  });

  it("strips override tags and converts \\N to a space", () => {
    const cues = parseAss(ass);
    expect(cues[1]!.text).toBe("急いで! 遅れるよ!");
  });
});

describe("parseSubtitles", () => {
  it("sorts by start and drops zero-duration cues", () => {
    const srt = [
      "1",
      "00:00:05,000 --> 00:00:06,000",
      "second",
      "",
      "2",
      "00:00:01,000 --> 00:00:02,000",
      "first",
      "",
      "3",
      "00:00:03,000 --> 00:00:03,000",
      "zero-length",
      "",
    ].join("\n");
    const cues = parseSubtitles(srt, "srt");
    expect(cues.map((c) => c.text)).toEqual(["first", "second"]);
  });
});
