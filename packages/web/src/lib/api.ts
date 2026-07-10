/** Client for the Phase-3 backend (packages/api), proxied under /api. */
import type { EpisodeSource } from "@joylingo/player-core";
import type {
  ClipCandidate,
  CurriculumWord,
  EduLessonId,
  FusionCard,
  VocabularyEntry,
  VocabularyMap,
} from "@joylingo/shared";
import { apiUrl } from "./api-base.js";

export interface YoutubeMetadata {
  videoId: string;
  title: string;
  channel: string;
}

export interface JimakuEntry {
  id: number;
  name: string;
  english_name: string | null;
  japanese_name: string | null;
  anilist_id?: number | null;
}

export interface JimakuFile {
  url: string;
  name: string;
  size: number;
  last_modified: string;
}

export interface EnrichJob {
  id: string;
  status: "pending" | "running" | "done" | "error";
  episodeId: string | null;
  error: string | null;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(url), init);
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Extract an 11-char video id from a YouTube URL or bare id. Null if none. */
export function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!/(^|\.)((youtube\.com)|(youtu\.be))$/.test(url.hostname)) return null;
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const shorts = /^\/(shorts|embed|live)\/([\w-]{11})/.exec(url.pathname);
    return shorts ? shorts[2]! : null;
  } catch {
    return null;
  }
}

/** Paste-URL lookup: EpisodeSource if the video is already in the catalog, else null. */
export async function lookupByYoutubeId(videoId: string): Promise<EpisodeSource | null> {
  const res = await fetch(apiUrl(`/api/episodes/by-youtube/${encodeURIComponent(videoId)}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(`Lookup failed (${res.status})`, res.status);
  return (await res.json()) as EpisodeSource;
}

export function fetchYoutubeMetadata(videoId: string): Promise<YoutubeMetadata> {
  return apiFetch(`/api/youtube/metadata?videoId=${encodeURIComponent(videoId)}`);
}

export async function searchJimaku(query: string): Promise<JimakuEntry[]> {
  const data = await apiFetch<{ entries: JimakuEntry[] }>(
    `/api/jimaku/search?q=${encodeURIComponent(query)}`,
  );
  return data.entries;
}

export async function listJimakuFiles(entryId: number, episode?: number): Promise<JimakuFile[]> {
  const ep = episode !== undefined ? `?episode=${episode}` : "";
  const data = await apiFetch<{ files: JimakuFile[] }>(
    `/api/jimaku/entries/${entryId}/files${ep}`,
  );
  return data.files;
}

export interface AnimeSummary {
  malId: number;
  romaji: string;
  english: string | null;
  native: string | null;
  coverImageURL: string | null;
  episodes: number | null;
  score: number | null;
}

export async function searchAnime(query: string): Promise<AnimeSummary[]> {
  const data = await apiFetch<{ results: AnimeSummary[] }>(
    `/api/anime/search?q=${encodeURIComponent(query)}`,
  );
  return data.results;
}

export interface VideoLink {
  quality: string;
  url: string;
  referer: string | null;
  providerName: string;
  isHls?: boolean;
}

export interface StreamBootstrap {
  match: { id: string; name: string; episodeCount: number; malId: number | null } | null;
  episodes: string[];
  titles: Record<string, string>;
  sources: VideoLink[];
}

export function fetchStreamBootstrap(opts: {
  malId: number;
  mode?: "sub" | "dub";
  showId?: string;
  episode?: string;
  /** Client-known titles when Jikan metadata isn't available yet. */
  fallbackTitles?: string[];
}): Promise<StreamBootstrap> {
  const params = new URLSearchParams({
    action: "bootstrap",
    malId: String(opts.malId),
    mode: opts.mode ?? "sub",
  });
  if (opts.showId) params.set("showId", opts.showId);
  if (opts.episode) params.set("episode", opts.episode);
  if (opts.fallbackTitles?.length) {
    params.set("titles", opts.fallbackTitles.join("|"));
  }
  return apiFetch(`/api/stream?${params.toString()}`);
}

export function fetchStreamSources(
  showId: string,
  episode: string,
  mode: "sub" | "dub" = "sub",
  malId?: number,
): Promise<VideoLink[]> {
  const params = new URLSearchParams({
    action: "sources",
    showId,
    episode,
    mode,
  });
  if (malId != null) params.set("malId", String(malId));
  return apiFetch<{ sources: VideoLink[] }>(`/api/stream?${params.toString()}`).then(
    (d) => d.sources,
  );
}

export function buildProxyUrl(url: string, referer: string | null): string {
  const params = new URLSearchParams({ url });
  if (referer) params.set("referer", referer);
  return apiUrl(`/api/proxy?${params.toString()}`);
}

export function streamSourceKey(source: VideoLink): string {
  return `${source.providerName}:${source.quality}:${source.url}`;
}

export function streamQualityLabel(source: VideoLink): string {
  return `${source.quality} · ${source.providerName}`;
}

/** Remove dead provider URLs before binding one to the player. */
export async function listPlayableStreamSources(
  sources: VideoLink[],
): Promise<VideoLink[]> {
  const candidates = sources.filter((source) => {
    try {
      const url = new URL(source.url);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });

  const checked = await Promise.all(
    candidates.map(async (source) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(
          buildProxyUrl(source.url, source.referer),
          {
            headers: { Range: "bytes=0-0" },
            signal: controller.signal,
          },
        );
        return response.ok ? source : null;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timeout);
      }
    }),
  );

  return checked.filter((source): source is VideoLink => source !== null);
}

/** Catalog lookup for an anime episode already enriched. */
export async function lookupByAnime(
  malId: number,
  episode: string,
  mode: "sub" | "dub" = "sub",
): Promise<EpisodeSource | null> {
  const params = new URLSearchParams({
    malId: String(malId),
    episode,
    mode,
  });
  const res = await fetch(apiUrl(`/api/episodes/by-anime?${params.toString()}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(`Lookup failed (${res.status})`, res.status);
  return (await res.json()) as EpisodeSource;
}

export interface CaptionTrack {
  lang: string;
  name: string;
  /** false → creator captions, true → auto-generated. */
  auto: boolean;
}

export interface CaptionTracks {
  videoId: string;
  title: string;
  tracks: CaptionTrack[];
  recommended: { ja: CaptionTrack | null; en: CaptionTrack | null };
}

/** Probe YouTube itself for caption tracks (server-side yt-dlp). */
export function fetchYoutubeCaptions(videoId: string): Promise<CaptionTracks> {
  return apiFetch(`/api/youtube/captions?videoId=${encodeURIComponent(videoId)}`);
}

export interface YoutubeImportRequest {
  youtubeVideoId: string;
  jaLang: string;
  jaAuto?: boolean;
  enLang?: string;
  enAuto?: boolean;
  title?: string;
  titleEn?: string;
}

/** Enrich straight from the video's own YouTube captions. */
export async function startYoutubeImport(req: YoutubeImportRequest): Promise<string> {
  const data = await apiFetch<{ jobId: string }>("/api/episodes/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...req, source: "youtube" }),
  });
  return data.jobId;
}

export interface ImportRequest {
  youtubeVideoId?: string;
  title: string;
  titleEn?: string;
  jimakuEntryId: number;
  jaFileUrl: string;
  jaFileName: string;
  enFileUrl?: string;
  enFileName?: string;
  malId?: number;
  showId?: string;
  animeEpisode?: string;
  streamMode?: "sub" | "dub";
}

export async function startImport(req: ImportRequest): Promise<string> {
  const data = await apiFetch<{ jobId: string }>("/api/episodes/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return data.jobId;
}

export function getImportJob(jobId: string): Promise<EnrichJob> {
  return apiFetch(`/api/episodes/import/${encodeURIComponent(jobId)}`);
}

/** Persist the sync-slider offset. Fails silently offline (static fallback mode). */
export async function patchSubtitleOffset(episodeId: string, offset: number): Promise<void> {
  try {
    await apiFetch(`/api/episodes/${encodeURIComponent(episodeId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subtitleOffset: offset }),
    });
  } catch {
    // API not running — the localStorage override still applies locally.
  }
}

export interface EncounterRequest {
  dict: string;
  reading: string;
  gloss: string | null;
  surface: string;
  episodeId: string;
  lineId: string;
  mined?: boolean;
}

/** Log a tap encounter server-side (best-effort). */
export async function postVocabularyEncounter(
  req: EncounterRequest,
  deviceId: string,
): Promise<void> {
  try {
    await apiFetch("/api/vocabulary/encounter", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-joylingo-device-id": deviceId,
      },
      body: JSON.stringify(req),
    });
  } catch {
    // Offline — localStorage remains source of truth.
  }
}

export async function postVocabularyMine(dict: string, deviceId: string): Promise<void> {
  try {
    await apiFetch("/api/vocabulary/mine", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-joylingo-device-id": deviceId,
      },
      body: JSON.stringify({ dict }),
    });
  } catch {
    // ignore
  }
}

export async function postKanjiReview(
  char: string,
  good: boolean,
  deviceId: string,
): Promise<void> {
  try {
    await apiFetch("/api/kanji/cards/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-joylingo-device-id": deviceId,
      },
      body: JSON.stringify({ char, good }),
    });
  } catch {
    // ignore
  }
}

export async function fetchVocabulary(
  deviceId: string,
): Promise<VocabularyMap> {
  const data = await apiFetch<{ entries: VocabularyEntry[] }>(
    "/api/vocabulary",
    { headers: { "x-joylingo-device-id": deviceId } },
  );
  return Object.fromEntries(data.entries.map((entry) => [entry.dict, entry]));
}

export async function pushVocabularySync(
  entries: VocabularyEntry[],
  deviceId: string,
): Promise<void> {
  if (entries.length === 0) return;
  await apiFetch("/api/vocabulary/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": deviceId,
    },
    body: JSON.stringify({ entries }),
  });
}

// --- Device profile (best-effort API mirror) ---------------------------------

export async function getProfile(deviceId: string): Promise<unknown | null> {
  try {
    const res = await fetch(apiUrl("/api/profile"), { headers: { "x-joylingo-device-id": deviceId } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as { profile: unknown };
  } catch {
    return null;
  }
}

export async function patchProfile(profile: unknown, deviceId: string): Promise<void> {
  try {
    await apiFetch("/api/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-joylingo-device-id": deviceId,
      },
      body: JSON.stringify(profile),
    });
  } catch {
    // best-effort
  }
}

/** List enriched catalog episodes for a favorite anime (filter by malId). */
export async function listEpisodesForAnime(
  malId: number,
): Promise<EpisodeSource[]> {
  try {
    const data = await apiFetch<{ episodes: EpisodeSource[] }>(
      `/api/episodes?malId=${encodeURIComponent(malId)}`,
    );
    return data.episodes;
  } catch {
    return [];
  }
}

export async function matchCurriculumClips(
  lessonId: EduLessonId,
  deviceId: string,
): Promise<{ candidates: ClipCandidate[]; words: Record<string, CurriculumWord> }> {
  return apiFetch("/api/curriculum/match", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": deviceId,
    },
    body: JSON.stringify({ lessonId }),
  });
}

export interface MatchWordInput {
  id: string;
  dict: string | null;
  surface: string;
  reading: string;
  gloss: string;
}

export async function matchWordClips(
  words: MatchWordInput[],
  deviceId: string,
): Promise<{
  candidates: ClipCandidate[];
  words: Record<string, CurriculumWord>;
}> {
  return apiFetch("/api/curriculum/match-words", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": deviceId,
    },
    body: JSON.stringify({ words }),
  });
}

export async function fetchCurriculumWords(
  lessonId: EduLessonId,
): Promise<CurriculumWord[]> {
  const data = await apiFetch<{ words: CurriculumWord[] }>(
    `/api/curriculum/words?lessonId=${encodeURIComponent(lessonId)}`,
  );
  return data.words;
}

export async function saveFusionClips(
  lessonId: EduLessonId,
  candidateKeys: string[],
  deviceId: string,
): Promise<FusionCard[]> {
  const data = await apiFetch<{ cards: FusionCard[] }>("/api/curriculum/clips", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": deviceId,
    },
    body: JSON.stringify({ lessonId, candidates: candidateKeys }),
  });
  return data.cards;
}

type DirectFusionClip = Omit<
  FusionCard,
  | "id"
  | "status"
  | "intervalDays"
  | "dueAt"
  | "lastReviewedAt"
  | "createdAt"
>;

export async function saveFusionClipsDirect(
  clips: DirectFusionClip[],
  deviceId: string,
): Promise<FusionCard[]> {
  const data = await apiFetch<{ cards: FusionCard[] }>(
    "/api/curriculum/clips/direct",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-joylingo-device-id": deviceId,
      },
      body: JSON.stringify({ clips }),
    },
  );
  return data.cards;
}

export async function fetchDueFusionCards(deviceId: string): Promise<FusionCard[]> {
  try {
    const data = await apiFetch<{ cards: FusionCard[] }>("/api/curriculum/clips/due", {
      headers: { "x-joylingo-device-id": deviceId },
    });
    return data.cards;
  } catch {
    return [];
  }
}

export async function postFusionReview(
  cardId: string,
  good: boolean,
  deviceId: string,
): Promise<FusionCard> {
  return apiFetch(`/api/curriculum/clips/${encodeURIComponent(cardId)}/review`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-joylingo-device-id": deviceId,
    },
    body: JSON.stringify({ good }),
  });
}
