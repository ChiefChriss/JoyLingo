import { describe, it, expect } from "vitest";
import { JmdictGlossProvider } from "../src/gloss/jmdict.js";
import type { JmdictFile } from "../src/gloss/jmdict-types.js";

const g = (text: string) => ({ lang: "eng", text });

const fixture: JmdictFile = {
  version: "3.5.0-test",
  dictDate: "2026-01-01",
  words: [
    {
      id: "1",
      kanji: [{ text: "電車", common: true, tags: [] }],
      kana: [{ text: "でんしゃ", common: true, tags: [], appliesToKanji: ["*"] }],
      sense: [{ partOfSpeech: ["n"], gloss: [g("train"), g("electric train")] }],
    },
    {
      id: "2",
      // homograph: 来る is a verb; force POS disambiguation
      kanji: [{ text: "来る", common: true, tags: [] }],
      kana: [{ text: "くる", common: true, tags: [], appliesToKanji: ["*"] }],
      sense: [
        { partOfSpeech: ["vk"], gloss: [g("to come"), g("to approach")] },
        { partOfSpeech: ["exp"], gloss: [g("some expression sense")] },
      ],
    },
  ],
};

describe("JmdictGlossProvider", () => {
  const provider = JmdictGlossProvider.fromFile(fixture);

  it("reports a versioned dictionary id", () => {
    expect(provider.id).toBe("jmdict-simplified@3.5.0-test");
  });

  it("looks up by kanji and joins senses", () => {
    expect(provider.lookup("電車", "noun")).toBe("train; electric train");
  });

  it("looks up by kana spelling too", () => {
    expect(provider.lookup("でんしゃ", "noun")).toBe("train; electric train");
  });

  it("prefers the sense matching the requested POS", () => {
    // "vk" (kuru verb) matches our "verb" via the v* prefix
    expect(provider.lookup("来る", "verb")).toBe("to come; to approach");
  });

  it("returns null for unknown words", () => {
    expect(provider.lookup("存在しない語", "noun")).toBeNull();
  });
});
