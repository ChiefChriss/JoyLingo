/**
 * Seed the catalog from the Phase-2 static manifest on first boot, so the API
 * serves the same episodes the static files did ("Start here" recommendations).
 *
 * `seedDevFavoriteAnime` clones sample enriched JSON onto common MAL ids so
 * local dev clip-matching works without importing via Jimaku first.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Episode } from "@joylingo/shared";
import { countEpisodes, upsertEpisode, type DB } from "./db.js";

// packages/api/{src,dist}/seed → packages/web/public/episodes
const EPISODES_DIR = fileURLToPath(new URL("../../web/public/episodes/", import.meta.url));

/** Popular onboarding picks — extend as needed for local clip-match testing. */
const DEV_FAVORITE_MAL_IDS = [
  21, // One Piece
  5114, // Fullmetal Alchemist: Brotherhood
  16498, // Attack on Titan
  40748, // Jujutsu Kaisen
  63824, // common pick in dev testing
] as const;

interface ManifestEntry {
  episodeId: string;
  file: string;
  youtubeVideoId: string | null;
  subtitleOffset?: number;
}

async function loadStaticEpisode(file: string): Promise<Episode | null> {
  try {
    const jsonPath = path.join(EPISODES_DIR, path.basename(file));
    return JSON.parse(await readFile(jsonPath, "utf8")) as Episode;
  } catch {
    return null;
  }
}

async function countEpisodesForMal(db: DB, malId: number): Promise<number> {
  const res = await db.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM episodes WHERE mal_id = $1",
    [malId],
  );
  return res.rows[0]?.c ?? 0;
}

/** Clone sample enriched episodes onto favorite malIds (local dev only). */
export async function seedDevFavoriteAnime(db: DB): Promise<number> {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEV_ANIME !== "true") {
    return 0;
  }

  const template =
    (await loadStaticEpisode("eki-de.json")) ??
    (await loadStaticEpisode("/episodes/eki-de.json"));
  if (!template) return 0;

  let seeded = 0;
  for (const malId of DEV_FAVORITE_MAL_IDS) {
    if ((await countEpisodesForMal(db, malId)) > 0) continue;
    const id = `dev-mal-${malId}-ep1`;
    await upsertEpisode(db, {
      id,
      episode: {
        ...template,
        title: `${template.title} (dev · MAL ${malId})`,
      },
      youtubeVideoId: null,
      subtitleOffset: 0,
      animeStream: { malId, showId: `dev-show-${malId}`, episode: "1", mode: "sub" },
      featured: false,
    });
    seeded++;
  }
  return seeded;
}

export async function seedIfEmpty(db: DB): Promise<number> {
  if ((await countEpisodes(db)) > 0) return 0;

  let manifest: { episodes: ManifestEntry[] };
  try {
    manifest = JSON.parse(await readFile(path.join(EPISODES_DIR, "index.json"), "utf8"));
  } catch {
    return 0; // no static manifest — nothing to seed
  }

  let seeded = 0;
  for (const [i, entry] of manifest.episodes.entries()) {
    const jsonPath = path.join(EPISODES_DIR, path.basename(entry.file));
    let episode: Episode;
    try {
      episode = JSON.parse(await readFile(jsonPath, "utf8"));
    } catch {
      continue;
    }
    await upsertEpisode(db, {
      id: entry.episodeId,
      episode,
      youtubeVideoId: entry.youtubeVideoId,
      subtitleOffset: entry.subtitleOffset ?? 0,
      featured: true,
      featuredRank: i,
    });
    seeded++;
  }
  return seeded;
}
