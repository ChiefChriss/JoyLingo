/**
 * Database layer — PGlite (embedded Postgres).
 *
 * Real Postgres SQL with zero local setup; the data lives in a directory
 * (API_DATA_DIR, default packages/api/.data). Moving to hosted Postgres later
 * means swapping PGlite for node-postgres — the SQL stays the same.
 */
import { PGlite } from "@electric-sql/pglite";
import type { Episode } from "@joylingo/shared";
import { VOCABULARY_SCHEMA } from "./vocabulary.js";
import { FUSION_SCHEMA } from "./curriculum-clips.js";

export type DB = PGlite;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS episodes (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  title_en          TEXT,
  duration          DOUBLE PRECISION NOT NULL DEFAULT 0,
  youtube_video_id  TEXT UNIQUE,
  subtitle_offset   DOUBLE PRECISION NOT NULL DEFAULT 0,
  enriched_json     JSONB NOT NULL,
  jimaku_entry_id   BIGINT,
  jimaku_file_name  TEXT,
  subtitle_source   TEXT,
  mal_id            INTEGER,
  stream_show_id    TEXT,
  anime_episode     TEXT,
  stream_mode       TEXT,
  featured          BOOLEAN NOT NULL DEFAULT false,
  featured_rank     INTEGER,
  play_count        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrich_jobs (
  id                TEXT PRIMARY KEY,
  youtube_video_id  TEXT,
  episode_id        TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subtitle_uploads (
    id                TEXT PRIMARY KEY,
    episode_id        TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    lang              TEXT NOT NULL,
    filename          TEXT NOT NULL,
    content           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id           TEXT PRIMARY KEY,
    profile           JSONB NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  );
 ${VOCABULARY_SCHEMA}
 ${FUSION_SCHEMA}

CREATE TABLE IF NOT EXISTS jimaku_youtube_mappings (
  youtube_video_id  TEXT PRIMARY KEY,
  jimaku_entry_id   BIGINT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const MIGRATIONS = [
  "ALTER TABLE episodes ADD COLUMN IF NOT EXISTS mal_id INTEGER",
  "ALTER TABLE episodes ADD COLUMN IF NOT EXISTS stream_show_id TEXT",
  "ALTER TABLE episodes ADD COLUMN IF NOT EXISTS anime_episode TEXT",
  "ALTER TABLE episodes ADD COLUMN IF NOT EXISTS stream_mode TEXT",
  `CREATE TABLE IF NOT EXISTS jimaku_youtube_mappings (
    youtube_video_id TEXT PRIMARY KEY,
    jimaku_entry_id BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `INSERT INTO jimaku_youtube_mappings (youtube_video_id, jimaku_entry_id)
   SELECT youtube_video_id, jimaku_entry_id FROM episodes
   WHERE youtube_video_id IS NOT NULL AND jimaku_entry_id IS NOT NULL
   ON CONFLICT (youtube_video_id) DO NOTHING`,
  "ALTER TABLE episodes ADD COLUMN IF NOT EXISTS subtitle_source TEXT",
  `UPDATE episodes SET subtitle_source = 'jimaku'
   WHERE subtitle_source IS NULL AND jimaku_entry_id IS NOT NULL`,
  `UPDATE episodes SET subtitle_source = 'youtube'
   WHERE subtitle_source IS NULL AND youtube_video_id IS NOT NULL`,
  `UPDATE episodes SET subtitle_source = 'upload'
   WHERE subtitle_source IS NULL`,
  "ALTER TABLE episodes ADD COLUMN IF NOT EXISTS subtitle_content_hash TEXT",
  "CREATE INDEX IF NOT EXISTS episodes_subtitle_content_hash_idx ON episodes (subtitle_content_hash)",
  "ALTER TABLE enrich_jobs ADD COLUMN IF NOT EXISTS content_hash TEXT",
  "CREATE INDEX IF NOT EXISTS enrich_jobs_content_hash_idx ON enrich_jobs (content_hash)",
];

export interface UserProfileRow {
  userId: string;
  profile: unknown;
  updatedAt: string;
}

export async function getUserProfile(db: DB, userId: string): Promise<UserProfileRow | null> {
  const res = await db.query<{ user_id: string; profile: unknown; updated_at: Date }>(
    "SELECT user_id, profile, updated_at FROM user_profiles WHERE user_id = $1",
    [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { userId: r.user_id, profile: r.profile, updatedAt: r.updated_at.toISOString() };
}

export async function upsertUserProfile(db: DB, userId: string, profile: unknown): Promise<UserProfileRow> {
  const res = await db.query<{ user_id: string; profile: unknown; updated_at: Date }>(
    `INSERT INTO user_profiles (user_id, profile, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET
       profile = EXCLUDED.profile,
       updated_at = now()
     RETURNING user_id, profile, updated_at`,
    [userId, JSON.stringify(profile)],
  );
  const r = res.rows[0]!;
  return { userId: r.user_id, profile: r.profile, updatedAt: r.updated_at.toISOString() };
}

export async function openDb(dataDir?: string): Promise<DB> {
  const db = await PGlite.create(dataDir ?? "memory://");
  await db.exec(SCHEMA);
  for (const sql of MIGRATIONS) await db.exec(sql);
  return db;
}

/** Anime stream binding — re-resolve CDN URLs on each watch session. */
export interface AnimeStreamBinding {
  malId: number;
  showId: string;
  episode: string;
  mode: "sub" | "dub";
}

/** Catalog entry shape the web client consumes (mirrors EpisodeSource). */
export interface EpisodeSourceRow {
  episodeId: string;
  title: string;
  titleEn: string | null;
  file: string;
  youtubeVideoId: string | null;
  subtitleOffset: number;
  featured: boolean;
  animeStream: AnimeStreamBinding | null;
  subtitleSource: "youtube" | "jimaku" | "upload" | null;
  jimakuFileName: string | null;
}

interface EpisodeRow {
  id: string;
  title: string;
  title_en: string | null;
  youtube_video_id: string | null;
  subtitle_offset: number;
  featured: boolean;
  mal_id: number | null;
  stream_show_id: string | null;
  anime_episode: string | null;
  stream_mode: string | null;
  subtitle_source: string | null;
  jimaku_file_name: string | null;
}

function toSource(r: EpisodeRow): EpisodeSourceRow {
  const animeStream =
    r.mal_id != null && r.stream_show_id && r.anime_episode && r.stream_mode
      ? {
          malId: r.mal_id,
          showId: r.stream_show_id,
          episode: r.anime_episode,
          mode: r.stream_mode as "sub" | "dub",
        }
      : null;
  const subtitleSource =
    r.subtitle_source === "youtube" || r.subtitle_source === "jimaku" || r.subtitle_source === "upload"
      ? r.subtitle_source
      : null;
  return {
    episodeId: r.id,
    title: r.title,
    titleEn: r.title_en,
    file: `/api/episodes/${encodeURIComponent(r.id)}`,
    youtubeVideoId: r.youtube_video_id,
    subtitleOffset: r.subtitle_offset,
    featured: r.featured,
    animeStream,
    subtitleSource,
    jimakuFileName: r.jimaku_file_name,
  };
}

const SOURCE_COLS =
  "id, title, title_en, youtube_video_id, subtitle_offset, featured, mal_id, stream_show_id, anime_episode, stream_mode, subtitle_source, jimaku_file_name";

export async function listEpisodes(
  db: DB,
  opts: { featuredOnly?: boolean; malId?: number } = {},
): Promise<EpisodeSourceRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts.featuredOnly) conditions.push("featured");
  if (opts.malId != null) {
    params.push(opts.malId);
    conditions.push(`mal_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const res = await db.query<EpisodeRow>(
    `SELECT ${SOURCE_COLS} FROM episodes ${where}
     ORDER BY featured DESC, featured_rank NULLS LAST, created_at DESC`,
    params,
  );
  return res.rows.map(toSource);
}

export async function getEpisodeSource(db: DB, id: string): Promise<EpisodeSourceRow | null> {
  const res = await db.query<EpisodeRow>(
    `SELECT ${SOURCE_COLS} FROM episodes WHERE id = $1`,
    [id],
  );
  return res.rows[0] ? toSource(res.rows[0]) : null;
}

export async function getEpisodeJson(db: DB, id: string): Promise<Episode | null> {
  const res = await db.query<{ enriched_json: Episode }>(
    "SELECT enriched_json FROM episodes WHERE id = $1",
    [id],
  );
  return res.rows[0]?.enriched_json ?? null;
}

export interface EnrichedEpisodeRow {
  id: string;
  title: string;
  playCount: number;
  enriched: Episode;
}

export async function listEnrichedEpisodesByMalIds(
  db: DB,
  malIds: number[],
): Promise<EnrichedEpisodeRow[]> {
  if (malIds.length === 0) return [];
  const res = await db.query<{
    id: string;
    title: string;
    play_count: number;
    enriched_json: Episode;
  }>(
    `SELECT id, title, play_count, enriched_json FROM episodes
     WHERE mal_id = ANY($1::int[])
     ORDER BY play_count DESC, created_at DESC`,
    [malIds],
  );
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    playCount: r.play_count,
    enriched: r.enriched_json,
  }));
}

export async function getEpisodeByYoutubeId(db: DB, videoId: string): Promise<EpisodeSourceRow | null> {
  const res = await db.query<EpisodeRow>(
    `SELECT ${SOURCE_COLS} FROM episodes WHERE youtube_video_id = $1`,
    [videoId],
  );
  return res.rows[0] ? toSource(res.rows[0]) : null;
}

export async function getEpisodeByAnime(
  db: DB,
  malId: number,
  episode: string,
  mode: string,
): Promise<EpisodeSourceRow | null> {
  const res = await db.query<EpisodeRow>(
    `SELECT ${SOURCE_COLS} FROM episodes
     WHERE mal_id = $1 AND anime_episode = $2 AND stream_mode = $3
     ORDER BY created_at DESC LIMIT 1`,
    [malId, episode, mode],
  );
  return res.rows[0] ? toSource(res.rows[0]) : null;
}

export async function getEpisodeIdByContentHash(db: DB, hash: string): Promise<string | null> {
  const res = await db.query<{ id: string }>(
    "SELECT id FROM episodes WHERE subtitle_content_hash = $1 LIMIT 1",
    [hash],
  );
  return res.rows[0]?.id ?? null;
}

export interface UpsertEpisodeInput {
  id: string;
  episode: Episode;
  youtubeVideoId?: string | null;
  subtitleOffset?: number;
  jimakuEntryId?: number | null;
  jimakuFileName?: string | null;
  subtitleSource?: "youtube" | "jimaku" | "upload" | null;
  animeStream?: AnimeStreamBinding | null;
  featured?: boolean;
  featuredRank?: number | null;
  subtitleContentHash?: string | null;
}

export async function upsertEpisode(db: DB, input: UpsertEpisodeInput): Promise<EpisodeSourceRow> {
  const res = await db.query<EpisodeRow>(
    `INSERT INTO episodes
       (id, title, title_en, duration, youtube_video_id, subtitle_offset,
        enriched_json, jimaku_entry_id, jimaku_file_name, subtitle_source,
        mal_id, stream_show_id, anime_episode, stream_mode,
        featured, featured_rank, subtitle_content_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       title_en = EXCLUDED.title_en,
       duration = EXCLUDED.duration,
       youtube_video_id = EXCLUDED.youtube_video_id,
       enriched_json = EXCLUDED.enriched_json,
       jimaku_entry_id = EXCLUDED.jimaku_entry_id,
       jimaku_file_name = EXCLUDED.jimaku_file_name,
       subtitle_source = COALESCE(EXCLUDED.subtitle_source, episodes.subtitle_source),
       mal_id = EXCLUDED.mal_id,
       stream_show_id = EXCLUDED.stream_show_id,
       anime_episode = EXCLUDED.anime_episode,
       stream_mode = EXCLUDED.stream_mode,
       subtitle_content_hash = COALESCE(EXCLUDED.subtitle_content_hash, episodes.subtitle_content_hash)
     RETURNING ${SOURCE_COLS}`,
    [
      input.id,
      input.episode.title,
      input.episode.titleEn,
      input.episode.duration,
      input.youtubeVideoId ?? null,
      input.subtitleOffset ?? 0,
      JSON.stringify(input.episode),
      input.jimakuEntryId ?? null,
      input.jimakuFileName ?? null,
      input.subtitleSource ?? null,
      input.animeStream?.malId ?? null,
      input.animeStream?.showId ?? null,
      input.animeStream?.episode ?? null,
      input.animeStream?.mode ?? null,
      input.featured ?? false,
      input.featuredRank ?? null,
      input.subtitleContentHash ?? null,
    ],
  );
  return toSource(res.rows[0]!);
}

export async function updateSubtitleOffset(
  db: DB,
  id: string,
  offset: number,
): Promise<EpisodeSourceRow | null> {
  const res = await db.query<EpisodeRow>(
    `UPDATE episodes SET subtitle_offset = $2 WHERE id = $1 RETURNING ${SOURCE_COLS}`,
    [id, offset],
  );
  return res.rows[0] ? toSource(res.rows[0]) : null;
}

export interface JimakuYoutubeMapping {
  youtubeVideoId: string;
  jimakuEntryId: number;
  updatedAt: string;
}

export async function getJimakuMapping(
  db: DB,
  youtubeVideoId: string,
): Promise<JimakuYoutubeMapping | null> {
  const res = await db.query<{ youtube_video_id: string; jimaku_entry_id: string; updated_at: Date }>(
    `SELECT youtube_video_id, jimaku_entry_id, updated_at
     FROM jimaku_youtube_mappings WHERE youtube_video_id = $1`,
    [youtubeVideoId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    youtubeVideoId: r.youtube_video_id,
    jimakuEntryId: Number(r.jimaku_entry_id),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function upsertJimakuMapping(
  db: DB,
  youtubeVideoId: string,
  jimakuEntryId: number,
): Promise<void> {
  await db.query(
    `INSERT INTO jimaku_youtube_mappings (youtube_video_id, jimaku_entry_id, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (youtube_video_id) DO UPDATE SET
       jimaku_entry_id = EXCLUDED.jimaku_entry_id,
       updated_at = now()`,
    [youtubeVideoId, jimakuEntryId],
  );
}

export async function countEpisodes(db: DB): Promise<number> {
  const res = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM episodes");
  return res.rows[0]!.n;
}

export async function saveSubtitleUpload(
  db: DB,
  episodeId: string,
  lang: string,
  filename: string,
  content: string,
): Promise<void> {
  await db.query(
    `INSERT INTO subtitle_uploads (id, episode_id, lang, filename, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [crypto.randomUUID(), episodeId, lang, filename, content],
  );
}

// --- enrich jobs -----------------------------------------------------------

export type JobStatus = "pending" | "running" | "done" | "error";

export interface EnrichJob {
  id: string;
  youtubeVideoId: string | null;
  episodeId: string | null;
  status: JobStatus;
  error: string | null;
}

interface JobRow {
  id: string;
  youtube_video_id: string | null;
  episode_id: string | null;
  status: JobStatus;
  error: string | null;
  content_hash: string | null;
}

function toJob(r: JobRow): EnrichJob {
  return {
    id: r.id,
    youtubeVideoId: r.youtube_video_id,
    episodeId: r.episode_id,
    status: r.status,
    error: r.error,
  };
}

export async function findInFlightJobByContentHash(
  db: DB,
  hash: string,
  excludeId?: string,
): Promise<EnrichJob | null> {
  const res = await db.query<JobRow>(
    `SELECT id, youtube_video_id, episode_id, status, error, content_hash
     FROM enrich_jobs
     WHERE content_hash = $1 AND status IN ('pending', 'running')
       AND ($2::text IS NULL OR id <> $2)
     ORDER BY created_at ASC
     LIMIT 1`,
    [hash, excludeId ?? null],
  );
  return res.rows[0] ? toJob(res.rows[0]) : null;
}

export async function createJob(db: DB, youtubeVideoId: string | null): Promise<EnrichJob> {
  const res = await db.query<JobRow>(
    `INSERT INTO enrich_jobs (id, youtube_video_id) VALUES ($1, $2)
     RETURNING id, youtube_video_id, episode_id, status, error, content_hash`,
    [crypto.randomUUID(), youtubeVideoId],
  );
  return toJob(res.rows[0]!);
}

export async function updateJob(
  db: DB,
  id: string,
  patch: { status: JobStatus; episodeId?: string; error?: string; contentHash?: string },
): Promise<void> {
  await db.query(
    `UPDATE enrich_jobs
     SET status = $2,
         episode_id = COALESCE($3, episode_id),
         error = $4,
         content_hash = COALESCE($5, content_hash),
         updated_at = now()
     WHERE id = $1`,
    [id, patch.status, patch.episodeId ?? null, patch.error ?? null, patch.contentHash ?? null],
  );
}

export async function getJob(db: DB, id: string): Promise<EnrichJob | null> {
  const res = await db.query<JobRow>(
    "SELECT id, youtube_video_id, episode_id, status, error, content_hash FROM enrich_jobs WHERE id = $1",
    [id],
  );
  return res.rows[0] ? toJob(res.rows[0]) : null;
}
