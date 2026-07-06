import { describe, expect, it } from "vitest";
import { decodeSubtitleBytes, stripNullBytes } from "../src/text-sanitize.js";

describe("stripNullBytes", () => {
  it("removes NUL characters", () => {
    expect(stripNullBytes("a\u0000b\u0000c")).toBe("abc");
  });
});

describe("decodeSubtitleBytes", () => {
  it("decodes UTF-16 LE with BOM", () => {
    const text = "[Script Info]\r\nTitle: Test";
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    expect(decodeSubtitleBytes(buf)).toBe(text);
  });

  it("decodes UTF-16 LE without BOM (common .ass)", () => {
    const text = "Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,hello";
    const buf = Buffer.from(text, "utf16le");
    expect(decodeSubtitleBytes(buf)).toBe(text);
  });

  it("strips embedded NULs from mis-decoded UTF-8", () => {
    const buf = Buffer.from("hello\u0000world", "utf8");
    expect(decodeSubtitleBytes(buf)).toBe("helloworld");
  });
});
