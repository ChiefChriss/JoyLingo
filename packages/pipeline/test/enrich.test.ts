import { describe, it, expect } from "vitest";
import { enrichEpisode } from "../src/enrich.js";
import type { GlossProvider } from "../src/gloss/provider.js";
import { isWord, type WordToken } from "@joylingo/shared";

/** Deterministic stub so enrich tests don't depend on a downloaded JMdict. */
const stubGloss: GlossProvider = {
  id: "stub@1",
  lookup: (dict) => `gloss:${dict}`,
};

const JA_SRT = [
  "1",
  "00:00:00,500 --> 00:00:04,000",
  "電車が来た。",
  "",
  "2",
  "00:00:04,500 --> 00:00:07,500",
  "急いで!",
  "",
].join("\n");

const EN_SRT = [
  "1",
  "00:00:00,000 --> 00:00:04,200",
  "The train's here.",
  "",
  "2",
  "00:00:04,400 --> 00:00:07,600",
  "Hurry up!",
  "",
].join("\n");

describe("enrichEpisode", () => {
  it("produces Episode JSON matching the client contract", async () => {
    const ep = await enrichEpisode(JA_SRT, {
      gloss: stubGloss,
      english: { content: EN_SRT },
      title: "駅で",
      titleEn: "At the Station",
      generatedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(ep.title).toBe("駅で");
    expect(ep.titleEn).toBe("At the Station");
    expect(ep.duration).toBeCloseTo(7.5);
    expect(ep.lines).toHaveLength(2);

    const l1 = ep.lines[0]!;
    expect(l1).toMatchObject({ id: "L1", start: 0.5, end: 4.0, en: "The train's here." });

    // word tokens carry the full lookup payload; glosses were filled
    const words = l1.tokens.filter(isWord) as WordToken[];
    for (const w of words) {
      expect(w.gloss).toBe(`gloss:${w.dict}`);
      expect(typeof w.dict).toBe("string");
      expect(["string", "object"]).toContain(typeof w.r); // string | null
    }

    // punctuation tokens carry only { s, punct }
    const period = l1.tokens.find((t) => t.s === "。");
    expect(period).toEqual({ s: "。", punct: true });

    expect(ep.meta).toMatchObject({
      source: "srt",
      dictionary: "stub@1",
      generatedAt: "2026-07-05T00:00:00.000Z",
    });
    expect(ep.meta?.tokenizer).toContain("kuromoji");
  });

  it("leaves en null when no English track is supplied and gloss null with the null provider", async () => {
    const ep = await enrichEpisode(JA_SRT);
    expect(ep.lines[0]!.en).toBeNull();
    const firstWord = ep.lines[0]!.tokens.find(isWord) as WordToken;
    expect(firstWord.gloss).toBeNull();
    expect(ep.meta?.dictionary).toBe("none");
  });

  it("assigns the second line's aligned English", async () => {
    const ep = await enrichEpisode(JA_SRT, { english: { content: EN_SRT } });
    expect(ep.lines[1]!.en).toBe("Hurry up!");
  });
});
