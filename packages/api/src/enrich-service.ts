/**
 * Server-side enrichment: raw subtitle text → Episode row. Reuses
 * @joylingo/pipeline as a library; the gloss provider (JMdict, ~16 MB) is
 * loaded once per process.
 */
import crypto from "node:crypto";
import { enrichEpisode, resolveGlossProvider, formatFromFilename } from "@joylingo/pipeline";
import type { GlossProvider } from "@joylingo/pipeline";
import type { Episode } from "@joylingo/shared";
import {
  upsertEpisode,
  saveSubtitleUpload,
  getEpisodeSource,
  getEpisodeByYoutubeId,
  getEpisodeByAnime,
  getEpisodeIdByContentHash,
  getEpisodeJson,
  upsertJimakuMapping,
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
  subtitleSource?: "youtube" | "jimaku" | "upload" | null;
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

/** Reuse catalog id when the same YouTube video or anime episode is re-imported. */
export async function resolveEpisodeId(
  db: DB,
  req: EnrichRequest,
  slugBase: string,
): Promise<string> {
  if (req.youtubeVideoId) {
    const existing = await getEpisodeByYoutubeId(db, req.youtubeVideoId);
    if (existing) return existing.episodeId;
  }
  if (req.animeStream) {
    const { malId, episode, mode } = req.animeStream;
    const existing = await getEpisodeByAnime(db, malId, episode, mode);
    if (existing) return existing.episodeId;
  }
  return uniqueEpisodeId(db, slugify(slugBase));
}

function cleanTrack(track: { filename: string; content: string }): {
  filename: string;
  content: string;
} {
  return { filename: track.filename, content: stripNullBytes(track.content) };
}

function normalizedJaContent(ja: { filename: string; content: string }): string {
  const cleaned = cleanTrack(ja);
  return formatFromFilename(cleaned.filename) === "srt"
    ? stripSrtReadingLines(cleaned.content)
    : cleaned.content;
}

/** SHA-256 of normalized subtitle tracks — dedup key for enrich jobs. */
export function computeEnrichContentHash(jaContent: string, enContent?: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(jaContent);
  if (enContent != null) hash.update("\0").update(enContent);
  return hash.digest("hex");
}

export function computeEnrichRequestHash(req: EnrichRequest): string {
  const jaContent = normalizedJaContent(req.ja);
  const enContent = req.en ? cleanTrack(req.en).content : undefined;
  return computeEnrichContentHash(jaContent, enContent);
}

export async function enrichToEpisode(db: DB, req: EnrichRequest): Promise<EpisodeSourceRow> {
  const gloss = await getGloss();
  const ja = cleanTrack(req.ja);
  const en = req.en ? cleanTrack(req.en) : undefined;

  const jaContent = normalizedJaContent(req.ja);
  const contentHash = computeEnrichContentHash(jaContent, en?.content);

  let episode: Episode;
  const cachedId = await getEpisodeIdByContentHash(db, contentHash);
  const cachedEpisode = cachedId ? await getEpisodeJson(db, cachedId) : null;
  if (cachedEpisode) {
    episode = cachedEpisode;
  } else {
    episode = sanitizeStringsDeep(
      await enrichEpisode(jaContent, {
        format: formatFromFilename(ja.filename),
        gloss,
        english: en ? { content: en.content, format: formatFromFilename(en.filename) } : undefined,
        title: req.title ? stripNullBytes(req.title) : undefined,
        titleEn: req.titleEn ? stripNullBytes(req.titleEn) : undefined,
      }),
    );
  }

  const id = await resolveEpisodeId(db, req, req.titleEn ?? req.title ?? ja.filename);
  const existing = await getEpisodeSource(db, id);

  const row = await upsertEpisode(db, {
    id,
    episode,
    youtubeVideoId: req.youtubeVideoId ?? existing?.youtubeVideoId ?? null,
    jimakuEntryId: req.jimakuEntryId ?? null,
    jimakuFileName: ja.filename,
    subtitleSource:
      req.subtitleSource ??
      (req.jimakuEntryId ? "jimaku" : req.youtubeVideoId ? "youtube" : "upload"),
    animeStream: req.animeStream ?? existing?.animeStream ?? null,
    subtitleContentHash: contentHash,
  });

  await saveSubtitleUpload(db, id, "ja", ja.filename, ja.content);
  if (en) await saveSubtitleUpload(db, id, "en", en.filename, en.content);

  if (req.youtubeVideoId && req.jimakuEntryId) {
    await upsertJimakuMapping(db, req.youtubeVideoId, req.jimakuEntryId);
  }

  return row;
}
