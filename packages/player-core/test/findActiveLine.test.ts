import { describe, it, expect } from "vitest";
import type { Line } from "@joylingo/shared";
import { findActiveLine } from "../src/findActiveLine.js";

const mkLine = (id: string, start: number, end: number): Line => ({
  id,
  start,
  end,
  en: null,
  tokens: [],
});

// Adjacent (L1/L2 share a boundary at t=3) plus a gap before L3.
const lines: Line[] = [
  mkLine("L1", 0, 3),
  mkLine("L2", 3, 5),
  mkLine("L3", 8, 10),
];

describe("findActiveLine", () => {
  it("finds the line containing t", () => {
    expect(findActiveLine(lines, 1.5)?.id).toBe("L1");
    expect(findActiveLine(lines, 4)?.id).toBe("L2");
    expect(findActiveLine(lines, 9.99)?.id).toBe("L3");
  });

  it("treats intervals as half-open [start, end)", () => {
    expect(findActiveLine(lines, 0)?.id).toBe("L1");
    // Shared boundary belongs to the later cue only — no double match.
    expect(findActiveLine(lines, 3)?.id).toBe("L2");
    expect(findActiveLine(lines, 5)).toBeNull();
    expect(findActiveLine(lines, 10)).toBeNull();
  });

  it("returns null in gaps and out of range", () => {
    expect(findActiveLine(lines, 6)).toBeNull();
    expect(findActiveLine(lines, -1)).toBeNull();
    expect(findActiveLine(lines, 100)).toBeNull();
  });

  it("handles empty and single-line inputs", () => {
    expect(findActiveLine([], 1)).toBeNull();
    expect(findActiveLine([mkLine("only", 2, 4)], 3)?.id).toBe("only");
    expect(findActiveLine([mkLine("only", 2, 4)], 1)).toBeNull();
  });
});
