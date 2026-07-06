/**
 * Seed the catalog from the Phase-2 static manifest on first boot, so the API
 * serves the same episodes the static files did ("Start here" recommendations).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Episode } from "@joylingo/shared";
import { countEpisodes, upsertEpisode, type DB } from "./db.js";

// packages/api/{src,dist}/seed → packages/web/public/episodes
const EPISODES_DIR = fileURLToPath(new URL("../../web/public/episodes/", import.meta.url));

interface ManifestEntry {
  episodeId: string;
  file: string;
  youtubeVideoId: string | null;
  subtitleOffset?: number;
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
