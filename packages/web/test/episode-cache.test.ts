import { describe, expect, it } from "vitest";
import {
  episodeCacheKey,
  episodeEtag,
  episodeGeneratedAt,
} from "../src/lib/episode-cache.js";
import type { Episode } from "@joylingo/shared";

describe("episode cache helpers", () => {
  it("builds composite cache keys from episodeId and generatedAt", () => {
    expect(episodeCacheKey("eki-de", "2026-01-01T00:00:00.000Z")).toBe(
      "eki-de:2026-01-01T00:00:00.000Z",
    );
    expect(episodeCacheKey("demo", "")).toBe("demo:");
  });

  it("matches server ETag format", () => {
    expect(episodeEtag("eki-de", "2026-01-01T00:00:00.000Z")).toBe(
      '"eki-de-2026-01-01T00:00:00.000Z"',
    );
    expect(episodeEtag("demo", "")).toBe('"demo-"');
  });

  it("reads generatedAt from episode meta", () => {
    const episode = {
      title: "t",
      titleEn: null,
      duration: 1,
      lines: [],
      meta: { source: "srt", tokenizer: "x", dictionary: "y", generatedAt: "2026-07-08T12:00:00.000Z" },
    } satisfies Episode;
    expect(episodeGeneratedAt(episode)).toBe("2026-07-08T12:00:00.000Z");
    expect(episodeGeneratedAt({ ...episode, meta: undefined })).toBe("");
  });
});
