import type { EpisodeSource } from "@joylingo/player-core";
import { openJoylingoDb } from "./episode-cache.js";

const MANIFEST_STORE = "manifest-cache";
const MANIFEST_KEY = "catalog";

export interface ManifestCacheRow {
  key: typeof MANIFEST_KEY;
  episodes: EpisodeSource[];
  etag: string | null;
  cachedAt: number;
  source: "api" | "static";
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function getCachedManifest(): Promise<ManifestCacheRow | null> {
  try {
    const db = await openJoylingoDb();
    if (!db) return null;

    const tx = db.transaction(MANIFEST_STORE, "readonly");
    const row = await idbRequest(tx.objectStore(MANIFEST_STORE).get(MANIFEST_KEY));
    await idbTxDone(tx);
    return (row as ManifestCacheRow | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedManifest(
  episodes: EpisodeSource[],
  etag: string | null,
  source: ManifestCacheRow["source"],
): Promise<void> {
  try {
    const db = await openJoylingoDb();
    if (!db) return;

    const row: ManifestCacheRow = {
      key: MANIFEST_KEY,
      episodes,
      etag,
      cachedAt: Date.now(),
      source,
    };

    const tx = db.transaction(MANIFEST_STORE, "readwrite");
    tx.objectStore(MANIFEST_STORE).put(row);
    await idbTxDone(tx);
  } catch {
    // Best-effort cache.
  }
}
