import type {
  Anime,
  TranslationMode,
  VideoLink,
} from "../allanime/types.js";
import { resolutionValue } from "../allanime/types.js";
import { TtlCache } from "../ttl-cache.js";

const MIRURO_API_URL =
  process.env.MIRURO_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
const ANILIST_URL = "https://graphql.anilist.co";
/**
 * Benchmarked + playback-tested 2026-07 (see scripts/bench-providers.mjs):
 * - bee:  HLS, plays cleanly in Chrome/hls.js through the proxy
 * - pewe: HLS, plays cleanly, fast segments (sub only)
 * - bonk: HLS, fine when present (~1/3 titles)
 * - moo:  mp4 progressive, reliable but ~1.2s startup — fallback
 * - kiwi: fast segments BUT animepahe audio is HE-AAC signalled as mp4a.40.1,
 *   which Chrome MediaSource rejects → fatal hls.js codec errors + stalls.
 *   Keep late in the list until that's solved (e.g. audio transmux).
 * - ally: mixed hls/mp4, mp4 links 401 through the proxy — unreliable
 * - hop:  embed-only, never yields direct streams — last
 */
const PROVIDER_ORDER = [
  "bee",
  "pewe",
  "bonk",
  "moo",
  "kiwi",
  "ally",
  "hop",
] as const;

const mappingCache = new TtlCache<AniListMapping | null>();
const episodeCache = new TtlCache<MiruroEpisodesResponse>(5 * 60 * 1000);

export interface MediaMatchInput {
  malId: number;
  titles: string[];
  episodes: number | null;
}

interface AniListMapping {
  id: number;
  title: string;
  episodes: number | null;
}

interface MiruroEpisode {
  id: string;
  number: number;
  title?: string;
}

interface MiruroEpisodesResponse {
  providers?: Record<
    string,
    { episodes?: { sub?: MiruroEpisode[]; dub?: MiruroEpisode[] } }
  >;
}

interface MiruroStream {
  url?: string;
  type?: string;
  quality?: string;
  referer?: string;
}

interface MiruroSourcesResponse {
  streams?: MiruroStream[];
}

async function anilistIdFromMal(malId: number): Promise<AniListMapping | null> {
  return mappingCache.getOrSet(String(malId), async () => {
    const response = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: `
          query ($id: Int) {
            Media(idMal: $id, type: ANIME) {
              id
              title { english romaji }
              episodes
            }
          }
        `,
        variables: { id: malId },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      data?: {
        Media?: {
          id?: number;
          title?: { english?: string | null; romaji?: string | null };
          episodes?: number | null;
        } | null;
      };
    };
    const media = json.data?.Media;
    if (!media?.id) return null;
    return {
      id: media.id,
      title:
        media.title?.english ??
        media.title?.romaji ??
        `Anime ${malId}`,
      episodes: media.episodes ?? null,
    };
  });
}

async function miruroGet<T>(path: string): Promise<T> {
  const response = await fetch(`${MIRURO_API_URL}${path}`, {
    signal: AbortSignal.timeout(50_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Stream sidecar failed (${response.status}): ${body.slice(0, 160)}`,
    );
  }
  return (await response.json()) as T;
}

function getEpisodeData(anilistId: number): Promise<MiruroEpisodesResponse> {
  return episodeCache.getOrSet(String(anilistId), () =>
    miruroGet<MiruroEpisodesResponse>(`/episodes/${anilistId}`),
  );
}

function providerNames(data: MiruroEpisodesResponse): string[] {
  const names = Object.keys(data.providers ?? {});
  const ordered = PROVIDER_ORDER.filter((name) => names.includes(name));
  const rest = names.filter(
    (name) => !ordered.includes(name as (typeof PROVIDER_ORDER)[number]),
  );
  return [...ordered, ...rest];
}

function episodesFor(
  data: MiruroEpisodesResponse,
  provider: string,
  mode: TranslationMode,
): MiruroEpisode[] {
  return data.providers?.[provider]?.episodes?.[mode] ?? [];
}

function findEpisode(
  data: MiruroEpisodesResponse,
  provider: string,
  episode: string,
  mode: TranslationMode,
): { episode: MiruroEpisode; category: TranslationMode } | null {
  const target = Number.parseFloat(episode);
  const modes: TranslationMode[] = [
    mode,
    mode === "sub" ? "dub" : "sub",
  ];
  for (const category of modes) {
    const match = episodesFor(data, provider, category).find(
      (item) =>
        item.number === target || String(item.number) === episode,
    );
    if (match) return { episode: match, category };
  }
  return null;
}

function toLinks(
  response: MiruroSourcesResponse,
  provider: string,
): VideoLink[] {
  const links: VideoLink[] = [];
  for (const stream of response.streams ?? []) {
    if (!stream.url || stream.type === "embed") continue;
    const isHls =
      stream.type === "hls" ||
      stream.url.includes(".m3u8") ||
      stream.url.includes("m3u8");
    links.push({
      quality: stream.quality ?? (isHls ? "hls" : "auto"),
      url: stream.url,
      referer: stream.referer ?? "https://kwik.cx/",
      providerName: `Miruro/${provider}`,
      isHls,
    });
  }
  return links;
}

export async function resolveMatch(
  input: MediaMatchInput,
  mode: TranslationMode,
): Promise<Anime | null> {
  const mapped = await anilistIdFromMal(input.malId);
  if (!mapped) return null;

  try {
    const data = await getEpisodeData(mapped.id);
    const counts = providerNames(data).map(
      (provider) => episodesFor(data, provider, mode).length,
    );
    const fallbackMode = mode === "sub" ? "dub" : "sub";
    const fallbackCounts = providerNames(data).map(
      (provider) => episodesFor(data, provider, fallbackMode).length,
    );
    const episodeCount = Math.max(
      ...counts,
      ...fallbackCounts,
      mapped.episodes ?? 0,
    );
    if (episodeCount <= 0) return null;
    return {
      id: String(mapped.id),
      name: mapped.title || input.titles[0] || `Anime ${mapped.id}`,
      episodeCount,
      malId: input.malId,
    };
  } catch {
    return {
      id: String(mapped.id),
      name: mapped.title || input.titles[0] || `Anime ${mapped.id}`,
      episodeCount: mapped.episodes ?? input.episodes ?? 0,
      malId: input.malId,
    };
  }
}

export async function getEpisodes(
  showId: string,
  mode: TranslationMode,
): Promise<string[]> {
  const anilistId = Number.parseInt(showId, 10);
  if (Number.isNaN(anilistId)) throw new Error("Invalid AniList show id");
  const data = await getEpisodeData(anilistId);

  const numbers = new Set<string>();
  for (const provider of providerNames(data)) {
    for (const episode of episodesFor(data, provider, mode)) {
      if (episode.number != null) numbers.add(String(episode.number));
    }
  }
  if (numbers.size === 0) {
    const fallbackMode = mode === "sub" ? "dub" : "sub";
    for (const provider of providerNames(data)) {
      for (const episode of episodesFor(data, provider, fallbackMode)) {
        if (episode.number != null) numbers.add(String(episode.number));
      }
    }
  }

  return [...numbers].sort(
    (left, right) =>
      (Number.parseFloat(left) || 0) - (Number.parseFloat(right) || 0),
  );
}

export async function getSources(
  showId: string,
  episode: string,
  mode: TranslationMode,
): Promise<VideoLink[]> {
  const anilistId = Number.parseInt(showId, 10);
  if (Number.isNaN(anilistId)) throw new Error("Invalid AniList show id");
  const data = await getEpisodeData(anilistId);

  const candidates = providerNames(data).flatMap((provider) => {
    const match = findEpisode(data, provider, episode, mode);
    return match ? [{ provider, ...match }] : [];
  });
  if (candidates.length === 0) {
    throw new Error(`Episode ${episode} is unavailable`);
  }

  const groups = await Promise.all(
    candidates.map(async ({ provider, category, episode: item }) => {
      const query = new URLSearchParams({
        episodeId: item.id,
        provider,
        anilistId: String(anilistId),
        category,
      });
      try {
        const response = await miruroGet<MiruroSourcesResponse>(
          `/sources?${query.toString()}`,
        );
        return toLinks(response, provider);
      } catch {
        return [] as VideoLink[];
      }
    }),
  );

  const unique = new Map<string, VideoLink>();
  for (const link of groups.flat()) unique.set(link.url, link);
  const links = [...unique.values()];
  if (links.length === 0) {
    throw new Error("No playable Miruro streams found");
  }

  const providerRank = new Map(
    providerNames(data).map((provider, index) => [
      `Miruro/${provider}`,
      index,
    ]),
  );
  // Provider speed first (order above is benchmark-driven), quality second —
  // a fast HLS stream starts far quicker than a slow 1080p mp4.
  return links.sort((left, right) => {
    const rank =
      (providerRank.get(left.providerName) ?? 99) -
      (providerRank.get(right.providerName) ?? 99);
    if (rank !== 0) return rank;
    return resolutionValue(right.quality) - resolutionValue(left.quality);
  });
}
