import { describe, it, expect } from "vitest";
import type { Line, WordToken } from "@joylingo/shared";
import { lineText, mineEntry, toDeck, type KnowledgeMap } from "../src/deck.js";

const tok = (s: string, over: Partial<WordToken> = {}): WordToken => ({
  s,
  r: null,
  dict: s,
  gloss: null,
  pos: "noun",
  ...over,
});

const line: Line = {
  id: "L1",
  start: 0,
  end: 3,
  en: "The train has come.",
  tokens: [
    tok("電車", { r: "でんしゃ", gloss: "train" }),
    tok("が", { pos: "particle" }),
    tok("来た", { r: "きた", dict: "来る", gloss: "to come" }),
    { s: "。", punct: true },
  ],
};

describe("lineText", () => {
  it("joins token surfaces including punctuation", () => {
    expect(lineText(line)).toBe("電車が来た。");
  });

  it("returns empty string for a line with no tokens", () => {
    expect(lineText({ ...line, tokens: [] })).toBe("");
  });
});

describe("mineEntry", () => {
  it("builds a learning entry with context from the full line", () => {
    const entry = mineEntry(line.tokens[0] as WordToken, line);
    expect(entry).toEqual({
      status: "learning",
      reading: "でんしゃ",
      gloss: "train",
      surface: "電車",
      context: "電車が来た。",
      contextEn: "The train has come.",
    });
  });

  it("falls back to surface when the token has no reading", () => {
    const entry = mineEntry(line.tokens[1] as WordToken, line);
    expect(entry.reading).toBe("が");
  });
});

describe("toDeck", () => {
  it("maps knowledge entries to cards keyed by dict form", () => {
    const knowledge: KnowledgeMap = {
      来る: mineEntry(line.tokens[2] as WordToken, line),
      電車: { ...mineEntry(line.tokens[0] as WordToken, line), status: "known" },
    };
    const deck = toDeck(knowledge);
    expect(deck).toHaveLength(2);
    const kuru = deck.find((c) => c.dict === "来る");
    expect(kuru?.surface).toBe("来た");
    expect(kuru?.status).toBe("learning");
    expect(deck.find((c) => c.dict === "電車")?.status).toBe("known");
  });

  it("returns an empty deck for empty knowledge", () => {
    expect(toDeck({})).toEqual([]);
  });
});
