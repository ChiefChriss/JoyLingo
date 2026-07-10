import { describe, it, expect } from "vitest";
import type { Line, WordToken } from "@joylingo/shared";
import { extractKanji } from "@joylingo/shared";
import {
  deriveKanjiProgress,
  dueKanjiCards,
  gradeKanjiCard,
  mergeVocabularyMaps,
  recordEncounter,
  seedKanjiCards,
  vocabularyEntriesNeedingPush,
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

describe("mergeVocabularyMaps", () => {
  const clip = { episodeId: "e1", lineId: "L1" };
  const base = {
    reading: "でんしゃ",
    gloss: "train",
    surface: "電車",
    firstClip: clip,
    lastClip: clip,
  };

  it("adds remote-only entries", () => {
    const remote = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 1,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
      },
    };
    expect(mergeVocabularyMaps({}, remote)).toEqual(remote);
  });

  it("keeps higher tap count and sticky mined flag", () => {
    const local = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 1,
        mined: true,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-02T00:00:00.000Z",
      },
    };
    const remote = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 3,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-03T00:00:00.000Z",
      },
    };
    const merged = mergeVocabularyMaps(local, remote);
    expect(merged["電車"]!.tapCount).toBe(3);
    expect(merged["電車"]!.mined).toBe(true);
  });

  it("preserves local when it has more taps", () => {
    const local = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 5,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-05T00:00:00.000Z",
      },
    };
    const remote = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 2,
        mined: true,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-02T00:00:00.000Z",
      },
    };
    const merged = mergeVocabularyMaps(local, remote);
    expect(merged["電車"]!.tapCount).toBe(5);
    expect(merged["電車"]!.mined).toBe(true);
  });
});

describe("vocabularyEntriesNeedingPush", () => {
  const clip = { episodeId: "e1", lineId: "L1" };
  const base = {
    reading: "でんしゃ",
    gloss: "train",
    surface: "電車",
    firstClip: clip,
    lastClip: clip,
  };

  it("pushes local-only entries", () => {
    const local = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 3,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-03T00:00:00.000Z",
      },
    };
    const merged = mergeVocabularyMaps(local, {});
    expect(vocabularyEntriesNeedingPush(local, {}, merged)).toHaveLength(1);
  });

  it("pushes when local wins merge over remote", () => {
    const local = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 5,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-05T00:00:00.000Z",
      },
    };
    const remote = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 2,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-02T00:00:00.000Z",
      },
    };
    const merged = mergeVocabularyMaps(local, remote);
    expect(vocabularyEntriesNeedingPush(local, remote, merged)).toHaveLength(1);
  });

  it("skips when remote wins merge", () => {
    const local = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 1,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-02T00:00:00.000Z",
      },
    };
    const remote = {
      電車: {
        dict: "電車",
        ...base,
        tapCount: 4,
        mined: false,
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-05T00:00:00.000Z",
      },
    };
    const merged = mergeVocabularyMaps(local, remote);
    expect(vocabularyEntriesNeedingPush(local, remote, merged)).toHaveLength(0);
  });
});
