import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEpisodes,
  getSources,
  resolveMatch,
} from "../src/miruro/client.js";

describe("Miruro client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps MAL ids and resolves playable HLS sources", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://graphql.anilist.co") {
        return Response.json({
          data: {
            Media: {
              id: 154587,
              title: { english: "Frieren", romaji: "Sousou no Frieren" },
              episodes: 28,
            },
          },
        });
      }
      if (url.endsWith("/episodes/154587")) {
        return Response.json({
          providers: {
            kiwi: {
              episodes: {
                sub: [
                  {
                    id: "animepahe:5319:60059:1",
                    number: 1,
                    title: "The Journey's End",
                  },
                ],
              },
            },
          },
        });
      }
      if (url.includes("/sources?")) {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("episodeId")).toBe(
          "animepahe:5319:60059:1",
        );
        expect(parsed.searchParams.get("provider")).toBe("kiwi");
        return Response.json({
          streams: [
            {
              type: "hls",
              quality: "1080p",
              url: "https://cdn.example/video.m3u8",
              referer: "https://kwik.cx/",
            },
            {
              type: "embed",
              quality: "1080p",
              url: "https://kwik.cx/e/example",
            },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const match = await resolveMatch(
      {
        malId: 52991,
        titles: ["Frieren"],
        episodes: 28,
      },
      "sub",
    );
    expect(match).toMatchObject({
      id: "154587",
      episodeCount: 28,
      malId: 52991,
    });
    await expect(getEpisodes("154587", "sub")).resolves.toEqual(["1"]);
    await expect(getSources("154587", "1", "sub")).resolves.toEqual([
      {
        quality: "1080p",
        url: "https://cdn.example/video.m3u8",
        referer: "https://kwik.cx/",
        providerName: "Miruro/kiwi",
        isHls: true,
      },
    ]);
  });
});
