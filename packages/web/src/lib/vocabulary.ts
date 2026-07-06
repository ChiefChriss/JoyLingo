/** Client-side vocabulary persistence (localStorage until API auth ships). */
import type {
  KanjiCardMap,
  KanjiProgressMap,
  VocabularyMap,
} from "@joylingo/shared";
import { deriveKanjiProgress, seedKanjiCards } from "@joylingo/player-core";

const VOCAB_KEY = "joylingo:vocabulary";
const KANJI_CARDS_KEY = "joylingo:kanji-cards";
const DEVICE_ID_KEY = "joylingo:device-id";

const storageCache = new Map<string, string | null>();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key) storageCache.delete(e.key);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") storageCache.clear();
  });
}

function getCachedItem(key: string): string | null {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key));
  }
  return storageCache.get(key) ?? null;
}

function setCachedItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  storageCache.set(key, value);
}

function removeCachedItem(key: string): void {
  localStorage.removeItem(key);
  storageCache.set(key, null);
}

export function getDeviceId(): string {
  let id = getCachedItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    setCachedItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function loadVocabulary(): VocabularyMap {
  try {
    const raw = getCachedItem(VOCAB_KEY);
    return raw ? (JSON.parse(raw) as VocabularyMap) : {};
  } catch {
    return {};
  }
}

export function saveVocabulary(vocabulary: VocabularyMap): void {
  setCachedItem(VOCAB_KEY, JSON.stringify(vocabulary));
}

export function loadKanjiCards(): KanjiCardMap {
  try {
    const raw = getCachedItem(KANJI_CARDS_KEY);
    return raw ? (JSON.parse(raw) as KanjiCardMap) : {};
  } catch {
    return {};
  }
}

export function saveKanjiCards(cards: KanjiCardMap): void {
  setCachedItem(KANJI_CARDS_KEY, JSON.stringify(cards));
}

/** Recompute kanji progress and seed SRS cards from current vocabulary. */
export function syncKanjiFromVocabulary(
  vocabulary: VocabularyMap,
  existingCards: KanjiCardMap,
): { progress: KanjiProgressMap; cards: KanjiCardMap } {
  const progress = deriveKanjiProgress(vocabulary);
  const cards = seedKanjiCards(progress, existingCards);
  return { progress, cards };
}

/** Invalidate cached reads after external localStorage writes (e.g. offset keys). */
export function invalidateStorageCache(key?: string): void {
  if (key) storageCache.delete(key);
  else storageCache.clear();
}
