import type { Episode } from "@joylingo/shared";
import type { EpisodeSource } from "@joylingo/player-core";
import { apiUrl } from "./api-base.js";
import {
  episodeEtag,
  episodeGeneratedAt,
  getLatestCachedEpisode,
  setCachedEpisode,
} from "./episode-cache.js";
import { getCachedManifest, setCachedManifest } from "./manifest-cache.js";

/**
 * Static catalog until the backend exists (Phase 3): /episodes/index.json
 * lists sources; each entry points at its enriched Episode JSON.
 *
 * Fetched JSON is shape-checked at this boundary so bad or partial files
 * fail with a readable load error instead of crashing deep in render.
 *
 * Episode JSON is cached in IndexedDB (keyed by episodeId + generatedAt) with
 * If-None-Match revalidation against the API ETag when available.
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function validateManifest(data: unknown): EpisodeSource[] {
  if (!isRecord(data) || !Array.isArray(data.episodes)) {
    throw new Error("Episode manifest is malformed: expected { episodes: [...] }");
  }
  for (const [i, ep] of data.episodes.entries()) {
    if (!isRecord(ep) || typeof ep.episodeId !== "string" || typeof ep.file !== "string") {
      throw new Error(`Episode manifest entry ${i} is malformed: expected episodeId and file strings`);
    }
  }
  return data.episodes as EpisodeSource[];
}

function validateEpisode(data: unknown, episodeId: string): Episode {
  const fail = (why: string): never => {
    throw new Error(`Episode "${episodeId}" JSON is malformed: ${why}`);
  };
  if (!isRecord(data)) fail("expected an object");
  const ep = data as Record<string, unknown>;
  if (typeof ep.title !== "string") fail("missing title");
  if (typeof ep.duration !== "number") fail("missing duration");
  if (!Array.isArray(ep.lines)) fail("missing lines array");
  for (const [i, line] of (ep.lines as unknown[]).entries()) {
    if (!isRecord(line)) fail(`line ${i} is not an object`);
    const l = line as Record<string, unknown>;
    if (typeof l.id !== "string") fail(`line ${i} missing id`);
    if (typeof l.start !== "number" || typeof l.end !== "number") {
      fail(`line ${i} missing start/end times`);
    }
    if (!Array.isArray(l.tokens)) fail(`line ${i} missing tokens array`);
    for (const [j, tok] of (l.tokens as unknown[]).entries()) {
      if (!isRecord(tok) || typeof (tok as Record<string, unknown>).s !== "string") {
        fail(`line ${i} token ${j} missing surface text`);
      }
    }
  }
  return data as Episode;
}

/**
 * Catalog from the API; if the API isn't running (dev without `npm run api`),
 * fall back to the Phase-2 static manifest so the player still works.
 *
 * Stale-while-revalidate: returns IndexedDB cache immediately when present,
 * then refreshes in the background (optional `onRevalidated` callback).
 */
export async function fetchManifest(opts?: {
  onRevalidated?: (episodes: EpisodeSource[]) => void;
}): Promise<EpisodeSource[]> {
  const cached = await getCachedManifest();
  if (cached) {
    void revalidateManifest(cached, opts?.onRevalidated);
    return cached.episodes;
  }
  return fetchManifestBlocking(opts?.onRevalidated);
}

async function revalidateManifest(
  cached: Awaited<ReturnType<typeof getCachedManifest>>,
  onRevalidated?: (episodes: EpisodeSource[]) => void,
): Promise<void> {
  if (!cached) return;
  try {
    const headers: HeadersInit = {};
    if (cached.etag) headers["If-None-Match"] = cached.etag;

    const res = await fetch(apiUrl("/api/episodes"), { headers });
    if (res.status === 304) return;
    if (!res.ok) return;

    const episodes = validateManifest(await res.json());
    await setCachedManifest(episodes, res.headers.get("ETag"), "api");
    onRevalidated?.(episodes);
  } catch {
    // Keep serving stale catalog.
  }
}

async function fetchManifestBlocking(
  onRevalidated?: (episodes: EpisodeSource[]) => void,
): Promise<EpisodeSource[]> {
  try {
    const res = await fetch(apiUrl("/api/episodes"));
    if (res.ok) {
      const episodes = validateManifest(await res.json());
      await setCachedManifest(episodes, res.headers.get("ETag"), "api");
      onRevalidated?.(episodes);
      return episodes;
    }
  } catch {
    // network/proxy failure → fall through to the static manifest
  }

  const res = await fetch("/episodes/index.json");
  if (!res.ok) throw new Error(`Failed to load episode manifest (${res.status})`);
  const episodes = validateManifest(await res.json());
  await setCachedManifest(episodes, null, "static");
  onRevalidated?.(episodes);
  return episodes;
}

export async function fetchEpisode(source: EpisodeSource): Promise<Episode> {
  const cached = await getLatestCachedEpisode(source.episodeId);
  const headers: HeadersInit = {};
  if (cached) {
    headers["If-None-Match"] = episodeEtag(
      source.episodeId,
      episodeGeneratedAt(cached),
    );
  }

  try {
    const res = await fetch(apiUrl(source.file), { headers });
    if (res.status === 304 && cached) return cached;
    if (!res.ok) {
      throw new Error(`Failed to load episode "${source.episodeId}" (${res.status})`);
    }
    const episode = validateEpisode(await res.json(), source.episodeId);
    await setCachedEpisode(source.episodeId, episode);
    return episode;
  } catch (err) {
    if (cached) return cached;
    throw err instanceof Error
      ? err
      : new Error(`Failed to load episode "${source.episodeId}"`);
  }
}

export function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
