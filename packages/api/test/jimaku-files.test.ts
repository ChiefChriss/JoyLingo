import { describe, expect, it } from "vitest";
import {
  filterJimakuSubtitleFiles,
  isArchiveFile,
  isSubtitleFile,
  matchesEpisodeFilename,
  pickBestJimakuFile,
} from "../src/jimaku-files.js";

describe("matchesEpisodeFilename", () => {
  it("matches Amazon-style 第178話 filenames", () => {
    expect(
      matchesEpisodeFilename(
        "ワンピース.S02E048.第178話 ほとばしる斬撃！.WEBRip.Amazon.ja-jp[sdh].srt",
        178,
      ),
    ).toBe(true);
  });

  it("does not match a different episode", () => {
    expect(
      matchesEpisodeFilename(
        "ワンピース.S02E044.第174話 幻の都！.WEBRip.Amazon.ja-jp[sdh].srt",
        178,
      ),
    ).toBe(false);
  });

  it("matches HorribleSubs-style numbering", () => {
    expect(matchesEpisodeFilename("[NanakoRaws] One Piece - 894 (BS-FUJI).ass", 894)).toBe(true);
  });
});

describe("filterJimakuSubtitleFiles", () => {
  const files = [
    { name: "[Netflix] OnePiece 1-1007 (VTT).zip", url: "", size: 1, last_modified: "" },
    {
      name: "ワンピース.S02E048.第178話 ほとばしる.WEBRip.Amazon.ja-jp[sdh].srt",
      url: "a",
      size: 1,
      last_modified: "",
    },
    {
      name: "ワンピース.S02E044.第174話 幻の都.WEBRip.Amazon.ja-jp[sdh].srt",
      url: "b",
      size: 1,
      last_modified: "",
    },
  ];

  it("drops archives and filters by episode", () => {
    const out = filterJimakuSubtitleFiles(files, 178);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toContain("第178話");
  });

  it("returns all subtitle files when episode is omitted", () => {
    expect(filterJimakuSubtitleFiles(files)).toHaveLength(2);
  });
});

describe("pickBestJimakuFile", () => {
  it("prefers .ass over .srt for the same episode", () => {
    const best = pickBestJimakuFile(
      [
        { name: "One Piece - 178.srt", url: "", size: 1, last_modified: "" },
        { name: "One Piece - 178.ass", url: "", size: 1, last_modified: "" },
      ],
      178,
    );
    expect(best?.name).toBe("One Piece - 178.ass");
  });
});

describe("file type helpers", () => {
  it("detects archives and subtitle extensions", () => {
    expect(isArchiveFile("bulk.zip")).toBe(true);
    expect(isSubtitleFile("ep178.srt")).toBe(true);
    expect(isSubtitleFile("bulk.zip")).toBe(false);
  });
});
