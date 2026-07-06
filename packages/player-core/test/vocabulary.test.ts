import { describe, it, expect } from "vitest";
import type { Line, WordToken } from "@joylingo/shared";
import { extractKanji } from "@joylingo/shared";
import {
  deriveKanjiProgress,
  dueKanjiCards,
  gradeKanjiCard,
  recordEncounter,
  seedKanjiCards,
  vocabularyList,
} from "../src/vocabulary.js";

const line: Line = {
  id: "L1",
  start: 0,
  end: 3,
  en: "The train has come.",
  tokens: [],
};

const tok = (over: Partial<WordToken> & { dict: string }): WordToken => ({
  s: over.dict,
  r: null,
  gloss: null,
  pos: "noun",
  ...over,
});

describe("extractKanji", () => {
  it("returns unique kanji in order", () => {
    expect(extractKanji("電車が来た")).toEqual(["電", "車", "来"]);
  });
});

describe("recordEncounter", () => {
  it("creates a new entry on first tap", () => {
    const store = recordEncounter(
      {
        tok: tok({ dict: "電車", s: "電車", r: "でんしゃ", gloss: "train" }),
        line,
        episodeId: "eki-de",
      },
      {},
    );
    expect(store["電車"]?.tapCount).toBe(1);
    expect(store["電車"]?.firstClip).toEqual({ episodeId: "eki-de", lineId: "L1" });
  });

  it("increments tap count on repeat", () => {
    const t = tok({ dict: "電車", s: "電車", r: "でんしゃ" });
    const once = recordEncounter({ tok: t, line, episodeId: "a" }, {});
    const twice = recordEncounter({ tok: t, line, episodeId: "b" }, once);
    expect(twice["電車"]?.tapCount).toBe(2);
    expect(twice["電車"]?.lastClip.episodeId).toBe("b");
  });
});

describe("deriveKanjiProgress", () => {
  it("aggregates kanji from tapped words", () => {
    const vocab = recordEncounter(
      {
        tok: tok({ dict: "電車", s: "電車", r: "でんしゃ" }),
        line,
        episodeId: "ep1",
      },
      {},
    );
    const progress = deriveKanjiProgress(vocab);
    expect(progress["電"]?.encounterCount).toBe(1);
    expect(progress["車"]?.exampleDicts).toContain("電車");
  });
});

describe("vocabularyList", () => {
  it("filters mined entries", () => {
    const vocab = {
      a: {
        dict: "a",
        reading: "a",
        gloss: null,
        surface: "a",
        tapCount: 1,
        mined: true,
        firstSeenAt: "1",
        lastSeenAt: "1",
        firstClip: { episodeId: "e", lineId: "L1" },
        lastClip: { episodeId: "e", lineId: "L1" },
      },
      b: {
        dict: "b",
        reading: "b",
        gloss: null,
        surface: "b",
        tapCount: 1,
        mined: false,
        firstSeenAt: "2",
        lastSeenAt: "2",
        firstClip: { episodeId: "e", lineId: "L1" },
        lastClip: { episodeId: "e", lineId: "L1" },
      },
    };
    expect(vocabularyList(vocab, { mined: false })).toHaveLength(1);
  });
});

describe("kanji SRS", () => {
  it("seeds cards for kanji with 2+ encounters", () => {
    const progress = deriveKanjiProgress({
      電車: {
        dict: "電車",
        reading: "でんしゃ",
        gloss: null,
        surface: "電車",
        tapCount: 2,
        mined: false,
        firstSeenAt: "1",
        lastSeenAt: "2",
        firstClip: { episodeId: "e", lineId: "L1" },
        lastClip: { episodeId: "e", lineId: "L1" },
      },
    });
    const cards = seedKanjiCards(progress);
    expect(cards["電"]).toBeDefined();
    expect(dueKanjiCards(cards).length).toBeGreaterThan(0);
  });

  it("schedules good grades with increasing interval", () => {
    const card = {
      char: "食",
      intervalDays: 0,
      repetitions: 0,
      dueAt: new Date().toISOString(),
      lastReviewedAt: null,
    };
    const graded = gradeKanjiCard(card, true);
    expect(graded.repetitions).toBe(1);
    expect(graded.intervalDays).toBe(1);
  });
});
