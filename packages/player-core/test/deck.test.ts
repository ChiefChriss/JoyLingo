import { describe, expect, it } from "vitest";
import type { Episode } from "@joylingo/shared";
import { attachWordReviewClips, toDeck, wordClipBounds, mineEntry } from "../src/deck.js";
import type { WordToken, Line } from "@joylingo/shared";

const TOK: WordToken = {
  s: "電車",
  r: "でんしゃ",
  dict: "電車",
  gloss: "train",
  pos: "n",
};
const LINE: Line = {
  id: "L1",
  start: 1,
  end: 4,
  en: "train",
  tokens: [TOK],
};

const EP: Episode = {
  title: "t",
  titleEn: null,
  duration: 10,
  lines: [
    {
      id: "L1",
      start: 1,
      end: 4,
      en: "train",
      tokens: [
        { s: "電車", r: "でんしゃ", dict: "電車", gloss: "train", pos: "n", t0: 1.2, t1: 1.8 },
      ],
    },
    {
      id: "L2",
      start: 5,
      end: 8,
      en: "again",
      tokens: [{ s: "電車", r: "でんしゃ", dict: "電車", gloss: "train", pos: "n" }],
    },
  ],
  meta: { timingSource: "karaoke" },
};

describe("wordClipBounds", () => {
  it("uses karaoke timing when available", () => {
    const b = wordClipBounds(EP, "L1", "電車");
    expect(b).toEqual({ clipStart: 0.9, clipEnd: 2.1 });
  });

  it("returns null for unknown line", () => {
    expect(wordClipBounds(EP, "L99", "電車")).toBeNull();
  });
});

describe("attachWordReviewClips", () => {
  it("uses lastClip as primary replay with bounds on current episode", () => {
    const card = toDeck({ 電車: mineEntry(TOK, LINE) })[0]!;
    const vocab = {
      dict: "電車",
      reading: "でんしゃ",
      gloss: "train",
      surface: "電車",
      tapCount: 2,
      mined: true,
      firstSeenAt: "a",
      lastSeenAt: "b",
      firstClip: { episodeId: "eki-de", lineId: "L1" },
      lastClip: { episodeId: "eki-de", lineId: "L2" },
    };
    const review = attachWordReviewClips(card, vocab, EP, "eki-de");
    expect(review.lastClip?.lineId).toBe("L2");
    expect(review.clip?.lineId).toBe("L2");
    expect(review.firstClip?.lineId).toBe("L1");
    expect(review.clip?.clipStart).toBeDefined();
  });
});
