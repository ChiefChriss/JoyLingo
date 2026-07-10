import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Episode } from "@joylingo/shared";
import { openDb, type DB } from "../src/db.js";
import { upsertEpisode } from "../src/db.js";
import { buildServer } from "../src/server.js";
import { stripSrtReadingLines } from "../src/enrich-service.js";

const EPISODE: Episode = {
  title: "テスト",
  titleEn: "Test",
  duration: 10,
  lines: [
    {
      id: "L1",
      start: 0,
      end: 2,
      en: "Hello",
      tokens: [{ s: "こんにちは", r: null, dict: "こんにちは", gloss: "hello", pos: "interj" }],
    },
  ],
};

describe("api server", () => {
  let db: DB;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await openDb();
    await upsertEpisode(db, {
      id: "test-ep",
      episode: EPISODE,
      youtubeVideoId: "abcdefghijk",
      featured: true,
      featuredRank: 0,
    });
    app = buildServer({ db, logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it("lists the catalog", async () => {
    const res = await app.inject({ method: "GET", url: "/api/episodes" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { episodes: Array<{ episodeId: string; file: string }> };
    expect(body.episodes).toHaveLength(1);
    expect(body.episodes[0]).toMatchObject({
      episodeId: "test-ep",
      file: "/api/episodes/test-ep",
      youtubeVideoId: "abcdefghijk",
    });
  });

  it("caches manifest with ETag and returns 304 when unchanged", async () => {
    const first = await app.inject({ method: "GET", url: "/api/episodes" });
    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toContain("stale-while-revalidate");
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();

    const cached = await app.inject({
      method: "GET",
      url: "/api/episodes",
      headers: { "if-none-match": etag },
    });
    expect(cached.statusCode).toBe(304);
    expect(cached.body).toBe("");
  });

  it("serves the enriched Episode JSON", async () => {
    const res = await app.inject({ method: "GET", url: "/api/episodes/test-ep" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: "テスト", duration: 10 });
  });

  it("caches episode JSON with ETag and returns 304 when unchanged", async () => {
    const first = await app.inject({ method: "GET", url: "/api/episodes/test-ep" });
    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toBe("public, max-age=3600");
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();

    const cached = await app.inject({
      method: "GET",
      url: "/api/episodes/test-ep",
      headers: { "if-none-match": etag },
    });
    expect(cached.statusCode).toBe(304);
    expect(cached.body).toBe("");
  });

  it("404s an unknown episode", async () => {
    const res = await app.inject({ method: "GET", url: "/api/episodes/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("looks up by YouTube video id", async () => {
    const hit = await app.inject({ method: "GET", url: "/api/episodes/by-youtube/abcdefghijk" });
    expect(hit.statusCode).toBe(200);
    expect((hit.json() as { episodeId: string }).episodeId).toBe("test-ep");

    const miss = await app.inject({ method: "GET", url: "/api/episodes/by-youtube/zzzzzzzzzzz" });
    expect(miss.statusCode).toBe(404);
  });

  it("PATCHes the subtitle offset and persists it", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/episodes/test-ep",
      payload: { subtitleOffset: 2.5 },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { subtitleOffset: number }).subtitleOffset).toBe(2.5);

    const list = await app.inject({ method: "GET", url: "/api/episodes" });
    const body = list.json() as { episodes: Array<{ subtitleOffset: number }> };
    expect(body.episodes[0]!.subtitleOffset).toBe(2.5);
  });

  it("rejects a PATCH without a numeric offset", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/episodes/test-ep",
      payload: { subtitleOffset: "abc" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("enriches a raw subtitle upload", async () => {
    const srt = "1\n00:00:01,000 --> 00:00:03,000\n駅で待っています\n";
    const res = await app.inject({
      method: "POST",
      url: "/api/episodes/enrich",
      payload: {
        title: "駅",
        titleEn: "Station Test",
        ja: { filename: "test.ja.srt", content: srt },
      },
    });
    expect(res.statusCode).toBe(201);
    const row = res.json() as { episodeId: string; file: string };
    expect(row.episodeId).toBe("station-test");

    const ep = await app.inject({ method: "GET", url: row.file });
    expect(ep.statusCode).toBe(200);
    const episode = ep.json() as Episode;
    expect(episode.lines).toHaveLength(1);
    expect(episode.lines[0]!.tokens.length).toBeGreaterThan(1);

    const source = await app.inject({ method: "GET", url: `${row.file}/source` });
    expect(source.statusCode).toBe(200);
    expect((source.json() as { subtitleSource: string }).subtitleSource).toBe("upload");
  }, 30_000);

  it("re-import upserts by youtube id instead of creating a duplicate slug", async () => {
    const srt = "1\n00:00:01,000 --> 00:00:03,000\nテスト\n";
    const res = await app.inject({
      method: "POST",
      url: "/api/episodes/enrich",
      payload: {
        titleEn: "Reimport Different Slug",
        youtubeVideoId: "abcdefghijk",
        ja: { filename: "reimport.srt", content: srt },
      },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { episodeId: string }).episodeId).toBe("test-ep");

    const list = await app.inject({ method: "GET", url: "/api/episodes" });
    const ids = (list.json() as { episodes: Array<{ episodeId: string }> }).episodes.map(
      (e) => e.episodeId,
    );
    expect(ids.filter((id) => id === "test-ep")).toHaveLength(1);
  }, 30_000);

  it("validates the enrich payload", async () => {
    const res = await app.inject({ method: "POST", url: "/api/episodes/enrich", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed videoId on import", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/episodes/import",
      payload: { jaFileUrl: "https://example.com/x.srt", jaFileName: "x.srt", youtubeVideoId: "bad" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("validates youtube import requires jaLang", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/episodes/import",
      payload: { source: "youtube", youtubeVideoId: "abcdefghijk" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects bad videoId on captions probe", async () => {
    const res = await app.inject({ method: "GET", url: "/api/youtube/captions?videoId=bad" });
    expect(res.statusCode).toBe(400);
  });

  it("requires a Jimaku API key for search (user header or server env)", async () => {
    const prev = process.env.JIMAKU_API_KEY;
    delete process.env.JIMAKU_API_KEY;
    const res = await app.inject({ method: "GET", url: "/api/jimaku/search?q=naruto" });
    expect(res.statusCode).toBe(503);
    expect((res.json() as { error: string }).error).toContain("not configured");
    if (prev) process.env.JIMAKU_API_KEY = prev;
  });

  it("logs vocabulary encounters and derives kanji progress", async () => {
    const headers = { "x-joylingo-device-id": "test-device" };
    const encounter = await app.inject({
      method: "POST",
      url: "/api/vocabulary/encounter",
      headers,
      payload: {
        dict: "電車",
        reading: "でんしゃ",
        gloss: "train",
        surface: "電車",
        episodeId: "test-ep",
        lineId: "L1",
      },
    });
    expect(encounter.statusCode).toBe(200);
    const entry = encounter.json() as { tapCount: number; dict: string };
    expect(entry.dict).toBe("電車");
    expect(entry.tapCount).toBe(1);

    const again = await app.inject({
      method: "POST",
      url: "/api/vocabulary/encounter",
      headers,
      payload: {
        dict: "電車",
        reading: "でんしゃ",
        gloss: "train",
        surface: "電車",
        episodeId: "test-ep",
        lineId: "L1",
      },
    });
    expect((again.json() as { tapCount: number }).tapCount).toBe(2);

    const list = await app.inject({ method: "GET", url: "/api/vocabulary", headers });
    expect((list.json() as { entries: unknown[] }).entries).toHaveLength(1);

    const kanji = await app.inject({ method: "GET", url: "/api/kanji/progress", headers });
    const progress = (kanji.json() as { progress: Array<{ char: string }> }).progress;
    expect(progress.some((p) => p.char === "電")).toBe(true);
    expect(progress.some((p) => p.char === "車")).toBe(true);

    await app.inject({
      method: "POST",
      url: "/api/vocabulary/mine",
      headers,
      payload: { dict: "電車" },
    });
    const mined = await app.inject({ method: "GET", url: "/api/vocabulary?mined=true", headers });
    expect((mined.json() as { entries: unknown[] }).entries).toHaveLength(1);
  });

  it("syncs vocabulary entries without incrementing tap counts", async () => {
    const headers = { "x-joylingo-device-id": "sync-device" };
    const entry = {
      dict: "食べる",
      reading: "たべる",
      gloss: "to eat",
      surface: "食べる",
      tapCount: 7,
      mined: true,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-06T00:00:00.000Z",
      firstClip: { episodeId: "test-ep", lineId: "L1" },
      lastClip: { episodeId: "test-ep", lineId: "L2" },
    };
    const sync = await app.inject({
      method: "POST",
      url: "/api/vocabulary/sync",
      headers,
      payload: { entries: [entry] },
    });
    expect(sync.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/vocabulary", headers });
    const rows = (list.json() as { entries: Array<{ dict: string; tapCount: number; mined: boolean }> })
      .entries;
    const row = rows.find((r) => r.dict === "食べる");
    expect(row?.tapCount).toBe(7);
    expect(row?.mined).toBe(true);

    const resync = await app.inject({
      method: "POST",
      url: "/api/vocabulary/sync",
      headers,
      payload: { entries: [{ ...entry, tapCount: 7 }] },
    });
    expect(resync.statusCode).toBe(200);
    const list2 = await app.inject({ method: "GET", url: "/api/vocabulary", headers });
    const row2 = (list2.json() as { entries: Array<{ tapCount: number }> }).entries.find(
      (r) => (r as { dict?: string }).dict === "食べる",
    );
    expect(row2?.tapCount).toBe(7);
  });

  it("caches and returns jimaku mapping by youtube video id", async () => {
    const { upsertJimakuMapping } = await import("../src/db.js");
    await upsertJimakuMapping(db, "maptestvid1", 12345);
    const hit = await app.inject({
      method: "GET",
      url: "/api/jimaku/mapping/by-youtube/maptestvid1",
    });
    expect(hit.statusCode).toBe(200);
    expect((hit.json() as { jimakuEntryId: number }).jimakuEntryId).toBe(12345);

    const miss = await app.inject({
      method: "GET",
      url: "/api/jimaku/mapping/by-youtube/zzzzzzzzzzz",
    });
    expect(miss.statusCode).toBe(404);
  });
});

describe("stripSrtReadingLines", () => {
  it("drops the kana line under each cue", () => {
    const src = "1\n00:00:00,000 --> 00:00:02,000\n駅で待つ\nえきでまつ\n\n2\n00:00:02,000 --> 00:00:04,000\nこんにちは\n";
    const out = stripSrtReadingLines(src);
    expect(out).not.toContain("えきでまつ");
    expect(out).toContain("駅で待つ");
    expect(out).toContain("こんにちは");
  });
});
