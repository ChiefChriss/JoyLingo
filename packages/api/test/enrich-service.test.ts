import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type DB } from "../src/db.js";
import { enrichToEpisode, computeEnrichRequestHash } from "../src/enrich-service.js";

const SRT = "1\n00:00:01,000 --> 00:00:03,000\nテスト\n";

describe("enrichToEpisode upsert", () => {
  let db: DB;

  beforeAll(async () => {
    db = await openDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it("reuses episode id when re-importing the same YouTube video", async () => {
    const first = await enrichToEpisode(db, {
      ja: { filename: "a.srt", content: SRT },
      titleEn: "Upsert Youtube A",
      youtubeVideoId: "upsertytttt",
    });
    const second = await enrichToEpisode(db, {
      ja: { filename: "b.srt", content: SRT },
      titleEn: "Upsert Youtube B Different Slug",
      youtubeVideoId: "upsertytttt",
    });
    expect(second.episodeId).toBe(first.episodeId);
  }, 30_000);

  it("reuses episode id when re-importing the same anime tuple", async () => {
    const stream = { malId: 99901, showId: "test-show", episode: "3", mode: "sub" as const };
    const first = await enrichToEpisode(db, {
      ja: { filename: "a.srt", content: SRT },
      titleEn: "Anime Upsert A",
      animeStream: stream,
    });
    const second = await enrichToEpisode(db, {
      ja: { filename: "b.srt", content: SRT },
      titleEn: "Anime Upsert B Different Slug",
      animeStream: stream,
    });
    expect(second.episodeId).toBe(first.episodeId);
  }, 30_000);

  it("preserves youtube binding when re-importing by anime tuple only", async () => {
    const stream = { malId: 99902, showId: "combo-show", episode: "1", mode: "sub" as const };
    const first = await enrichToEpisode(db, {
      ja: { filename: "a.srt", content: SRT },
      titleEn: "Combo First",
      youtubeVideoId: "comboYoutube1",
      animeStream: stream,
    });
    const second = await enrichToEpisode(db, {
      ja: { filename: "b.srt", content: SRT },
      titleEn: "Combo Reimport",
      animeStream: stream,
    });
    expect(second.episodeId).toBe(first.episodeId);
    expect(second.youtubeVideoId).toBe("comboYoutube1");
  }, 30_000);

  it("persists jimaku mapping when youtube and jimaku entry are set", async () => {
    const { getJimakuMapping } = await import("../src/db.js");
    await enrichToEpisode(db, {
      ja: { filename: "a.srt", content: SRT },
      titleEn: "Mapping Test",
      youtubeVideoId: "mapenrich01",
      jimakuEntryId: 77701,
      subtitleSource: "jimaku",
    });
    const mapping = await getJimakuMapping(db, "mapenrich01");
    expect(mapping?.jimakuEntryId).toBe(77701);
  }, 30_000);

  it("stores subtitle provenance on enrich", async () => {
    const { getEpisodeSource } = await import("../src/db.js");
    const row = await enrichToEpisode(db, {
      ja: { filename: "prov.srt", content: SRT },
      titleEn: "Provenance Youtube",
      youtubeVideoId: "provytube01",
      subtitleSource: "youtube",
    });
    const source = await getEpisodeSource(db, row.episodeId);
    expect(source?.subtitleSource).toBe("youtube");
    expect(source?.jimakuFileName).toBe("prov.srt");
  }, 30_000);

  it("hashes normalized subtitle content identically across filenames", () => {
    const h1 = computeEnrichRequestHash({ ja: { filename: "a.srt", content: SRT } });
    const h2 = computeEnrichRequestHash({ ja: { filename: "b.srt", content: SRT } });
    expect(h1).toBe(h2);
  });

  it("reuses enriched JSON when subtitle content hash matches", async () => {
    const uniqueSrt = `1\n00:00:01,000 --> 00:00:03,000\nDedup${Date.now()}\n`;
    const { getEpisodeJson } = await import("../src/db.js");
    const first = await enrichToEpisode(db, {
      ja: { filename: "first.srt", content: uniqueSrt },
      titleEn: "Hash Dedup First",
    });
    const second = await enrichToEpisode(db, {
      ja: { filename: "second.srt", content: uniqueSrt },
      titleEn: "Hash Dedup Second",
      youtubeVideoId: "hashdedup01",
    });
    const ep1 = await getEpisodeJson(db, first.episodeId);
    const ep2 = await getEpisodeJson(db, second.episodeId);
    expect(ep1?.meta?.generatedAt).toBe(ep2?.meta?.generatedAt);
    expect(ep2?.lines).toEqual(ep1?.lines);
  }, 30_000);
});
