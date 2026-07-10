import type { Episode } from "@joylingo/shared";

const DB_NAME = "joylingo";
const STORE = "episode-cache";
const MANIFEST_STORE = "manifest-cache";
const MANIFEST_KEY = "catalog";
const DB_VERSION = 2;

/** Composite cache key — matches tracker spec (episodeId + generatedAt). */
export function episodeCacheKey(episodeId: string, generatedAt: string): string {
  return `${episodeId}:${generatedAt}`;
}

/** Client ETag aligned with packages/api/src/server.ts episodeEtag. */
export function episodeEtag(episodeId: string, generatedAt: string): string {
  return `"${episodeId}-${generatedAt}"`;
}

export function episodeGeneratedAt(episode: Episode): string {
  return episode.meta?.generatedAt ?? "";
}

interface CacheRow {
  cacheKey: string;
  episodeId: string;
  generatedAt: string;
  episode: Episode;
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** Shared JoyLingo IndexedDB — episode + manifest caches. */
export function openJoylingoDb(): Promise<IDBDatabase | null> {
  return openDb();
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => resolve(null);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "cacheKey" });
            store.createIndex("episodeId", "episodeId", { unique: false });
          }
          if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
            db.createObjectStore(MANIFEST_STORE, { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
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

/** Latest cached episode for an id, or null when IDB is unavailable / empty. */
export async function getLatestCachedEpisode(episodeId: string): Promise<Episode | null> {
  try {
    const db = await openDb();
    if (!db) return null;

    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("episodeId");
    const rows = await idbRequest(index.getAll(episodeId));
    await idbTxDone(tx);

    if (!rows.length) return null;

    const latest = (rows as CacheRow[]).reduce((best, row) =>
      row.generatedAt > best.generatedAt ? row : best,
    );
    return latest.episode;
  } catch {
    return null;
  }
}

/** Persist episode JSON; prune older versions for the same episodeId. */
export async function setCachedEpisode(episodeId: string, episode: Episode): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;

    const generatedAt = episodeGeneratedAt(episode);
    const cacheKey = episodeCacheKey(episodeId, generatedAt);
    const row: CacheRow = {
      cacheKey,
      episodeId,
      generatedAt,
      episode,
      cachedAt: Date.now(),
    };

    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(row);

    const index = store.index("episodeId");
    const existing = await idbRequest(index.getAll(episodeId));
    for (const old of existing as CacheRow[]) {
      if (old.cacheKey !== cacheKey) store.delete(old.cacheKey);
    }

    await idbTxDone(tx);
  } catch {
    // Best-effort cache — never block playback.
  }
}
