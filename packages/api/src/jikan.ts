/**
 * Minimal Jikan v4 client for anime search and metadata.
 */

import { TtlCache } from "./ttl-cache.js";

const BASE = "https://api.jikan.moe/v4";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const searchCache = new TtlCache<AnimeSummary[]>();
const animeCache = new TtlCache<AnimeSummary>();
const episodeListCache = new TtlCache<EpisodeMeta[]>();

export interface AnimeSummary {
  malId: number;
  romaji: string;
  english: string | null;
  native: string | null;
  synonyms: string[];
  coverImageURL: string | null;
  episodes: number | null;
  score: number | null;
}

export interface EpisodeMeta {
  number: number;
  title: string;
}

type JikanAnime = {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: string[];
  images?: { jpg?: { image_url?: string; large_image_url?: string } };
  episodes?: number | null;
  score?: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAnime(data: JikanAnime): AnimeSummary {
  return {
    malId: data.mal_id,
    romaji: data.title ?? "Untitled",
    english: data.title_english ?? null,
    native: data.title_japanese ?? null,
    synonyms: data.title_synonyms ?? [],
    coverImageURL:
      data.images?.jpg?.large_image_url ?? data.images?.jpg?.image_url ?? null,
    episodes: data.episodes ?? null,
    score: data.score ?? null,
  };
}

export function matchTitles(anime: AnimeSummary): string[] {
  const ordered: string[] = [];
  if (anime.english) ordered.push(anime.english);
  ordered.push(anime.romaji);
  if (anime.native) ordered.push(anime.native);
  ordered.push(...anime.synonyms);
  const seen = new Set<string>();
  return ordered.filter((t) => t.length > 0 && !seen.has(t) && seen.add(t));
}

async function jikanFetch<T>(path: string, attempts = 4): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 1200 : 350 * attempt);

    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Accept: "application/json" },
      });
      const json: unknown = await res.json();

      const status =
        json && typeof json === "object" && "status" in json
          ? (json as { status?: number }).status
          : undefined;

      if ((typeof status === "number" && status >= 400) || !res.ok) {
        const code = typeof status === "number" ? status : res.status;
        lastError = new Error(`Jikan request failed (${code})`);
        if (RETRYABLE.has(code)) continue;
        throw lastError;
      }

      return json as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Jikan request failed");
      if (attempt < attempts - 1) continue;
    }
  }

  throw lastError ?? new Error("Jikan request failed");
}

async function fetchSearchAnime(query: string, limit: number): Promise<AnimeSummary[]> {
  const json = await jikanFetch<{ data?: JikanAnime[] }>(
    `/anime?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  const seen = new Set<number>();
  const out: AnimeSummary[] = [];
  for (const item of json.data ?? []) {
    if (seen.has(item.mal_id)) continue;
    seen.add(item.mal_id);
    out.push(parseAnime(item));
  }
  return out;
}

export async function searchAnime(query: string, limit = 25): Promise<AnimeSummary[]> {
  const key = `search:${query.trim().toLowerCase()}:${limit}`;
  return searchCache.getOrSet(key, () => fetchSearchAnime(query, limit));
}

async function fetchAnime(malId: number): Promise<AnimeSummary> {
  const json = await jikanFetch<{ data: JikanAnime }>(`/anime/${malId}`);
  return parseAnime(json.data);
}

export async function getAnime(malId: number): Promise<AnimeSummary> {
  return animeCache.getOrSet(`anime:${malId}`, () => fetchAnime(malId));
}

type JikanEpisode = { mal_id: number; title?: string };

async function fetchAnimeEpisodes(malId: number): Promise<EpisodeMeta[]> {
  const all: EpisodeMeta[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= 50) {
    if (page > 1) await sleep(400);

    const json = await jikanFetch<{
      data?: JikanEpisode[];
      pagination?: { has_next_page?: boolean };
    }>(`/anime/${malId}/episodes?page=${page}`);

    for (const ep of json.data ?? []) {
      const title = ep.title?.trim();
      if (title) all.push({ number: ep.mal_id, title });
    }

    hasNext = json.pagination?.has_next_page === true;
    page++;
  }

  return all;
}

export async function listAnimeEpisodes(malId: number): Promise<EpisodeMeta[]> {
  return episodeListCache.getOrSet(`episodes:${malId}`, () => fetchAnimeEpisodes(malId));
}

export function parseEpisodeNumber(raw: string): number | null {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

/** Map AllAnime episode ids to Jikan/MAL episode titles. */
export function buildEpisodeTitleMap(
  providerEpisodes: string[],
  metas: EpisodeMeta[],
): Record<string, string> {
  if (providerEpisodes.length === 0 || metas.length === 0) return {};

  const byNumber = new Map<number, string>();
  for (const meta of metas) {
    if (!byNumber.has(meta.number)) byNumber.set(meta.number, meta.title);
  }

  const sortedProvider = [...providerEpisodes].sort(
    (a, b) => (parseEpisodeNumber(a) ?? Infinity) - (parseEpisodeNumber(b) ?? Infinity),
  );
  const sortedMeta = [...metas].sort((a, b) => a.number - b.number);

  const out: Record<string, string> = {};

  for (let index = 0; index < sortedProvider.length; index++) {
    const epId = sortedProvider[index]!;
    const n = parseEpisodeNumber(epId);
    if (n != null) {
      const exact = byNumber.get(n);
      if (exact) {
        out[epId] = exact;
        continue;
      }
      const floored = byNumber.get(Math.floor(n));
      if (floored) {
        out[epId] = floored;
        continue;
      }
    }
    const meta = sortedMeta[index];
    if (meta) out[epId] = meta.title;
  }

  return out;
}
