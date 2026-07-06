import { describe, expect, it } from "vitest";
import {
  parseCaptionTracks,
  pickBestEnTrack,
  pickBestJaTrack,
  type CaptionTrack,
} from "../src/youtube-captions.js";

const fmt = (name?: string) => [{ ext: "srt", ...(name ? { name } : {}) }];

describe("parseCaptionTracks", () => {
  it("parses the morning-routine shape (manual ja + en)", () => {
    const cc = parseCaptionTracks("Jh2C7JlWGKU", {
      title: "My Morning Routine",
      subtitles: { en: fmt("English"), ja: fmt("Japanese") },
      automatic_captions: { "ja-en": fmt("Japanese from English") },
    });
    expect(cc.title).toBe("My Morning Routine");
    expect(cc.recommended.ja).toMatchObject({ lang: "ja", auto: false, name: "Japanese" });
    expect(cc.recommended.en).toMatchObject({ lang: "en", auto: false });
  });

  it("falls back to auto-generated original Japanese", () => {
    const cc = parseCaptionTracks("x", {
      subtitles: {},
      automatic_captions: {
        "ja-orig": fmt("Japanese (Original)"),
        ja: fmt("Japanese"),
        en: fmt("English"),
      },
    });
    expect(cc.recommended.ja).toMatchObject({ lang: "ja-orig", auto: true });
    expect(cc.recommended.en).toMatchObject({ lang: "en", auto: true });
  });

  it("returns null recommendations when there is no Japanese at all", () => {
    const cc = parseCaptionTracks("x", {
      subtitles: { en: fmt("English") },
      automatic_captions: { "ja-en": fmt("Japanese from English") },
    });
    expect(cc.recommended.ja).toBeNull();
    expect(cc.recommended.en).toMatchObject({ lang: "en", auto: false });
  });
});

describe("track pickers", () => {
  const t = (lang: string, auto: boolean): CaptionTrack => ({ lang, name: lang, auto });

  it("prefers manual ja over manual ja-orig and any auto track", () => {
    const tracks = [t("ja-orig", false), t("ja", false), t("ja", true)];
    expect(pickBestJaTrack(tracks)).toMatchObject({ lang: "ja", auto: false });
  });

  it("accepts unusual manual ja-* keys before auto tracks", () => {
    const tracks = [t("ja-x-custom", false), t("ja", true)];
    expect(pickBestJaTrack(tracks)).toMatchObject({ lang: "ja-x-custom", auto: false });
  });

  it("never picks machine-translated auto tracks (ja-en, ja-zh-Hans)", () => {
    const tracks = [t("ja-en", true), t("ja-zh-Hans", true)];
    expect(pickBestJaTrack(tracks)).toBeNull();
  });

  it("prefers en over en-US, manual over auto", () => {
    const tracks = [t("en-US", false), t("en", false), t("en", true)];
    expect(pickBestEnTrack(tracks)).toMatchObject({ lang: "en", auto: false });
  });

  it("returns null when no english track exists", () => {
    expect(pickBestEnTrack([t("ja", false)])).toBeNull();
  });
});

describe.runIf(process.env.YTCC_INTEGRATION === "1")("listCaptionTracks (integration)", () => {
  it("lists manual ja+en for morning-routine video", async () => {
    const { listCaptionTracks } = await import("../src/youtube-captions.js");
    const cc = await listCaptionTracks("Jh2C7JlWGKU");
    expect(cc.recommended.ja).toMatchObject({ lang: "ja", auto: false });
    expect(cc.recommended.en).toMatchObject({ lang: "en", auto: false });
  }, 45_000);
});
