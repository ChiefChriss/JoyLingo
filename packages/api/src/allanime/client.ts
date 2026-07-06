import { decryptToBeParsed } from "./crypto.js";
import { scoreMatch } from "./title-matcher.js";
import { extractSource, AGENT, REFERER } from "./source-extractor.js";
import type { Anime, SourceEntry, TranslationMode, VideoLink } from "./types.js";
import { resolutionValue } from "./types.js";

const API_URL = "https://api.allanime.day/api";
const EPISODE_QUERY_HASH =
  "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

export interface MediaMatchInput {
  malId: number;
  titles: string[];
  episodes: number | null;
}

function parseMalId(raw: unknown): number | null {
  if (typeof raw === "string") return parseInt(raw, 10) || null;
  if (typeof raw === "number") return raw;
  return null;
}

async function apiPost(
  query: string,
  variables: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": AGENT,
      Referer: REFERER,
      Origin: REFERER,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error("AllAnime request failed");
  return res.json() as Promise<Record<string, unknown>>;
}

function extractPairs(jsonString: string): SourceEntry[] {
  const entries: SourceEntry[] = [];
  const regex = /"sourceUrl":"([^"]*)"[^}]*?"sourceName":"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(jsonString)) !== null) {
    const url = match[1]?.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
    const name = match[2];
    if (url && name) entries.push({ name, url });
  }
  return entries;
}

function parseSourceEntries(data: ArrayBuffer, rawString: string): SourceEntry[] {
  if (rawString.includes("tobeparsed")) {
    const b64 = rawString.match(/"tobeparsed":"([^"]*)"/)?.[1];
    if (b64) {
      const decrypted = decryptToBeParsed(b64);
      if (decrypted) return extractPairs(decrypted);
    }
  }

  try {
    const json = JSON.parse(new TextDecoder().decode(data)) as {
      data?: { episode?: { sourceUrls?: { sourceUrl?: string; sourceName?: string }[] } };
    };
    const sourceUrls = json.data?.episode?.sourceUrls;
    if (sourceUrls) {
      return sourceUrls
        .map((s) => (s.sourceUrl ? { name: s.sourceName ?? "source", url: s.sourceUrl } : null))
        .filter((e): e is SourceEntry => e != null);
    }
  } catch {
    /* fall through */
  }

  return extractPairs(rawString);
}

async function fetchEntriesPersisted(variables: Record<string, unknown>): Promise<SourceEntry[]> {
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH },
    }),
  });

  const url = `${API_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": AGENT, Referer: REFERER, Origin: REFERER },
  });
  if (!res.ok) return [];
  const buf = await res.arrayBuffer();
  const raw = new TextDecoder().decode(buf);
  return parseSourceEntries(buf, raw);
}

async function fetchEntriesPost(variables: Record<string, unknown>): Promise<SourceEntry[]> {
  const query = `
    query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
      episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
        episodeString
        sourceUrls
      }
    }
  `;
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": AGENT,
      Referer: REFERER,
      Origin: REFERER,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) return [];
  const buf = await res.arrayBuffer();
  const raw = new TextDecoder().decode(buf);
  return parseSourceEntries(buf, raw);
}

export async function searchAllAnime(query: string, mode: TranslationMode): Promise<Anime[]> {
  const gql = `
    query($search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType) {
      shows(search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin) {
        edges { _id name malId availableEpisodes __typename }
      }
    }
  `;
  const json = await apiPost(gql, {
    search: { allowAdult: false, allowUnknown: false, query },
    limit: 40,
    page: 1,
    translationType: mode,
    countryOrigin: "ALL",
  });

  const edges = (
    (json.data as Record<string, unknown>)?.shows as Record<string, unknown>
  )?.edges as Record<string, unknown>[] | undefined;

  if (!edges?.length) return [];

  return edges
    .map((edge) => {
      const id = edge._id as string;
      const name = edge.name as string;
      if (!id || !name) return null;
      const available = edge.availableEpisodes as Record<string, number>;
      const count = available?.[mode] ?? 0;
      if (count <= 0) return null;
      return { id, name, episodeCount: count, malId: parseMalId(edge.malId) } satisfies Anime;
    })
    .filter((a): a is Anime => a != null);
}

export async function resolveMatch(
  input: MediaMatchInput,
  mode: TranslationMode,
): Promise<Anime | null> {
  const { malId, titles, episodes } = input;
  const seen = new Set<string>();
  let best: { anime: Anime; score: number } | null = null;

  for (const title of titles) {
    let results: Anime[];
    try {
      results = await searchAllAnime(title, mode);
    } catch {
      continue;
    }

    for (const result of results) {
      if (seen.has(result.id)) continue;
      seen.add(result.id);

      if (result.malId === malId && result.episodeCount > 0) return result;

      let total = scoreMatch(result.name, result.episodeCount, titles, episodes);
      if (result.malId === malId && result.episodeCount > 0) total += 1;

      if (!best || total > best.score) best = { anime: result, score: total };
    }

    if (best && best.score >= 1) break;
  }

  if (!best || best.score < 0.3) return null;
  return best.anime;
}

export async function getEpisodes(showId: string, mode: TranslationMode): Promise<string[]> {
  const gql = `
    query ($showId: String!) {
      show(_id: $showId) { _id availableEpisodesDetail }
    }
  `;
  const json = await apiPost(gql, { showId });
  const detail = (
    (json.data as Record<string, unknown>)?.show as Record<string, unknown>
  )?.availableEpisodesDetail as Record<string, string[]> | undefined;
  const raw = detail?.[mode] ?? [];
  return [...raw].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
}

export async function getSources(
  showId: string,
  episode: string,
  mode: TranslationMode,
): Promise<VideoLink[]> {
  const variables = { showId, translationType: mode, episodeString: episode };

  let entries = await fetchEntriesPersisted(variables);
  if (entries.length === 0) entries = await fetchEntriesPost(variables);
  if (entries.length === 0) throw new Error("No sources found");

  const linkGroups = await Promise.all(entries.map((e) => extractSource(e)));
  const links = linkGroups.flat();
  if (links.length === 0) throw new Error("No playable sources found");

  const seen = new Set<string>();
  const unique: VideoLink[] = [];
  for (const link of links) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    unique.push(link);
  }

  return unique.sort((a, b) => resolutionValue(b.quality) - resolutionValue(a.quality));
}
