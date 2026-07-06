import {
  getEpisodes,
  getSources,
  resolveMatch,
  type MediaMatchInput,
} from "./allanime/client.js";
import type { Anime, TranslationMode, VideoLink } from "./allanime/types.js";
import {
  buildEpisodeTitleMap,
  getAnime,
  listAnimeEpisodes,
  matchTitles,
} from "./jikan.js";

export interface StreamBootstrap {
  match: Anime | null;
  episodes: string[];
  titles: Record<string, string>;
  sources: VideoLink[];
}

export async function streamBootstrap(opts: {
  malId: number;
  mode: TranslationMode;
  showId?: string;
  episode?: string;
  /** Used when Jikan is rate-limited but the client already knows the title. */
  fallbackTitles?: string[];
}): Promise<StreamBootstrap> {
  const { malId, mode, showId: showIdParam, episode, fallbackTitles = [] } = opts;

  let match: Anime | null = null;
  let showId = showIdParam;

  if (showIdParam) {
    const episodes = await getEpisodes(showIdParam, mode);
    let titles: Record<string, string> = {};
    try {
      const metas = await listAnimeEpisodes(malId);
      titles = buildEpisodeTitleMap(episodes, metas);
    } catch {
      /* optional */
    }

    let sources: VideoLink[] = [];
    if (episode) {
      sources = await getSources(showIdParam, episode, mode);
    }

    return { match: null, episodes, titles, sources };
  }

  const anime = await getAnime(malId).catch(() => null);
  const searchTitles =
    anime != null
      ? matchTitles(anime)
      : fallbackTitles.filter((t) => t.trim().length > 0);
  if (searchTitles.length === 0) {
    throw new Error("Could not resolve anime title — Jikan may be rate-limited, try again shortly");
  }
  const input: MediaMatchInput = {
    malId,
    titles: searchTitles,
    episodes: anime?.episodes ?? null,
  };
  match = await resolveMatch(input, mode);
  if (!match) return { match: null, episodes: [], titles: {}, sources: [] };

  showId = match.id;
  const episodes = await getEpisodes(showId, mode);
  let episodeTitles: Record<string, string> = {};
  try {
    const metas = await listAnimeEpisodes(malId);
    episodeTitles = buildEpisodeTitleMap(episodes, metas);
  } catch {
    /* optional */
  }

  let sources: VideoLink[] = [];
  if (episode) {
    sources = await getSources(showId, episode, mode);
  }

  return { match, episodes, titles: episodeTitles, sources };
}

export async function streamSources(
  showId: string,
  episode: string,
  mode: TranslationMode,
): Promise<VideoLink[]> {
  return getSources(showId, episode, mode);
}
