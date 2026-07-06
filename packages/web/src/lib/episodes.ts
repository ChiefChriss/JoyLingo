import type { Episode } from "@joylingo/shared";
import type { EpisodeSource } from "@joylingo/player-core";

/**
 * Static catalog until the backend exists (Phase 3): /episodes/index.json
 * lists sources; each entry points at its enriched Episode JSON.
 *
 * Fetched JSON is shape-checked at this boundary so bad or partial files
 * fail with a readable load error instead of crashing deep in render.
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
 */
export async function fetchManifest(): Promise<EpisodeSource[]> {
  try {
    const res = await fetch("/api/episodes");
    if (res.ok) return validateManifest(await res.json());
  } catch {
    // network/proxy failure → fall through to the static manifest
  }
  const res = await fetch("/episodes/index.json");
  if (!res.ok) throw new Error(`Failed to load episode manifest (${res.status})`);
  return validateManifest(await res.json());
}

export async function fetchEpisode(source: EpisodeSource): Promise<Episode> {
  const res = await fetch(source.file);
  if (!res.ok) throw new Error(`Failed to load episode "${source.episodeId}" (${res.status})`);
  return validateEpisode(await res.json(), source.episodeId);
}

export function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
