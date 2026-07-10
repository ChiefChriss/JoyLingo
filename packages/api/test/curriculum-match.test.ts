import { describe, expect, it } from "vitest";
import type { CurriculumWord } from "@joylingo/shared";
import { fusionVocabLessonId, lessonSupportsFusion } from "@joylingo/shared";
import { getCurriculumWords, matchCurriculumClips, matchWordsToClips } from "../src/curriculum-match.js";

/** Minimal in-memory DB stub for listEnrichedEpisodesByMalIds. */
function mockDb(episodes: { id: string; title: string; malId: number; enriched: object; playCount: number }[]) {
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (!sql.includes("enriched_json")) return { rows: [] };
      const malIds = (params?.[0] as number[]) ?? [];
      const rows = episodes
        .filter((e) => malIds.includes(e.malId))
        .map((e) => ({
          id: e.id,
          title: e.title,
          enriched_json: e.enriched,
          play_count: e.playCount,
        }));
      return { rows };
    },
  } as import("../src/db.js").DB;
}

const SAMPLE_EPISODE = {
  lines: [
    {
      id: "L1",
      start: 1,
      end: 4,
      en: "It's a train.",
      tokens: [
        { t: "w", s: "電車", r: "でんしゃ", dict: "電車", gloss: "train", t0: 1.2, t1: 1.8 },
        { t: "w", s: "だ", r: "だ", dict: "だ", gloss: "to be" },
      ],
    },
  ],
  meta: { timingSource: "karaoke" as const },
};

describe("matchWordsToClips", () => {
  it("finds clips for a target word in favorite-anime episodes", async () => {
    const db = mockDb([
      { id: "ep-1", title: "Test Ep 1", malId: 21, enriched: SAMPLE_EPISODE, playCount: 3 },
    ]);
    const words: CurriculumWord[] = [
      {
        id: "mined:電車",
        lessonId: "03",
        surface: "電車",
        reading: "でんしゃ",
        gloss: "train",
        dict: "電車",
      },
    ];
    const hits = await matchWordsToClips(db, words, [21]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.dict).toBe("電車");
    expect(hits[0]?.clipStart).toBeLessThan(hits[0]!.clipEnd);
  });

  it("returns empty when no episodes match malIds", async () => {
    const db = mockDb([
      { id: "ep-1", title: "Test Ep 1", malId: 21, enriched: SAMPLE_EPISODE, playCount: 0 },
    ]);
    const words: CurriculumWord[] = [
      {
        id: "mined:電車",
        lessonId: "03",
        surface: "電車",
        reading: "でんしゃ",
        gloss: "train",
        dict: "電車",
      },
    ];
    expect(await matchWordsToClips(db, words, [999])).toEqual([]);
  });
});

describe("fusion vocab lesson mapping", () => {
  it("enables fusion on all vocab-backed edu lessons", () => {
    expect(lessonSupportsFusion("02")).toBe(true);
    expect(lessonSupportsFusion("03")).toBe(true);
    expect(lessonSupportsFusion("04")).toBe(true);
    expect(lessonSupportsFusion("05")).toBe(true);
    expect(lessonSupportsFusion("06")).toBe(true);
    expect(fusionVocabLessonId("02")).toBe("03");
    expect(fusionVocabLessonId("04")).toBe("05");
    expect(fusionVocabLessonId("06")).toBe("05");
  });

  it("skips kana and keigo lessons without vocab index", () => {
    expect(lessonSupportsFusion("01")).toBe(false);
    expect(lessonSupportsFusion("07")).toBe(false);
  });

  it("resolves grammar lesson words from paired vocab index", async () => {
    const fromGrammar = await getCurriculumWords("02");
    const fromVocab = await getCurriculumWords("03");
    expect(fromGrammar.length).toBeGreaterThan(0);
    expect(fromGrammar).toEqual(fromVocab);
  });

  it("matchCurriculumClips uses vocab source for grammar lessons", async () => {
    const db = mockDb([
      { id: "ep-1", title: "Test Ep 1", malId: 21, enriched: SAMPLE_EPISODE, playCount: 1 },
    ]);
    const hits = await matchCurriculumClips(db, "02", [21]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.dict).toBe("電車");
  });
});
