/**
 * Server-side enrichment: raw subtitle text → Episode row. Reuses
 * @joylingo/pipeline as a library; the gloss provider (JMdict, ~16 MB) is
 * loaded once per process.
 */
import { enrichEpisode, resolveGlossProvider, formatFromFilename } from "@joylingo/pipeline";
import type { GlossProvider } from "@joylingo/pipeline";
import {
  upsertEpisode,
  saveSubtitleUpload,
  getEpisodeSource,
  type AnimeStreamBinding,
  type DB,
  type EpisodeSourceRow,
} from "./db.js";
import { sanitizeStringsDeep, stripNullBytes } from "./text-sanitize.js";

let glossPromise: Promise<GlossProvider> | null = null;

function getGloss(): Promise<GlossProvider> {
  if (!glossPromise) glossPromise = resolveGlossProvider();
  return glossPromise;
}

export interface EnrichRequest {
  ja: { filename: string; content: string };
  en?: { filename: string; content: string };
  title?: string;
  titleEn?: string;
  youtubeVideoId?: string | null;
  jimakuEntryId?: number | null;
  animeStream?: AnimeStreamBinding | null;
}

/**
 * The ja track sometimes carries a kana reading line under each cue (common on
 * learner channels' own captions). The pipeline generates furigana itself, so
 * keep only the first text line per cue.
 */
export function stripSrtReadingLines(content: string): string {
  const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const cleaned = blocks.map((b) => {
    const lines = b.split("\n");
    // index line + timing line + text lines → keep first text line only
    if (lines.length > 3 && lines[1]?.includes("-->")) return lines.slice(0, 3).join("\n");
    return b;
  });
  return cleaned.join("\n\n") + "\n";
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "episode";
}

async function uniqueEpisodeId(db: DB, base: string): Promise<string> {
  let id = base;
  for (let n = 2; await getEpisodeSource(db, id); n++) id = `${base}-${n}`;
  return id;
}

function cleanTrack(track: { filename: string; content: string }): {
  filename: string;
  content: string;
} {
  return { filename: track.filename, content: stripNullBytes(track.content) };
}

export async function enrichToEpisode(db: DB, req: EnrichRequest): Promise<EpisodeSourceRow> {
  const gloss = await getGloss();
  const ja = cleanTrack(req.ja);
  const en = req.en ? cleanTrack(req.en) : undefined;

  const jaContent =
    formatFromFilename(ja.filename) === "srt" ? stripSrtReadingLines(ja.content) : ja.content;

  const episode = sanitizeStringsDeep(
    await enrichEpisode(jaContent, {
      format: formatFromFilename(ja.filename),
      gloss,
      english: en ? { content: en.content, format: formatFromFilename(en.filename) } : undefined,
      title: req.title ? stripNullBytes(req.title) : undefined,
      titleEn: req.titleEn ? stripNullBytes(req.titleEn) : undefined,
    }),
  );

  const id = await uniqueEpisodeId(db, slugify(req.titleEn ?? req.title ?? ja.filename));
  const row = await upsertEpisode(db, {
    id,
    episode,
    youtubeVideoId: req.youtubeVideoId ?? null,
    jimakuEntryId: req.jimakuEntryId ?? null,
    jimakuFileName: ja.filename,
    animeStream: req.animeStream ?? null,
  });

  await saveSubtitleUpload(db, id, "ja", ja.filename, ja.content);
  if (en) await saveSubtitleUpload(db, id, "en", en.filename, en.content);
  return row;
}
