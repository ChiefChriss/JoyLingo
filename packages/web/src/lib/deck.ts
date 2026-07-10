/** Persistent mined word deck (Phase 5): KnowledgeMap mirrored to localStorage. */
import { ensureWordFsrs, type KnowledgeMap } from "@joylingo/player-core";

const KEY = "joylingo:word-deck";

let cached: KnowledgeMap | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cached = null;
  });
}

export function loadDeck(): KnowledgeMap {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as KnowledgeMap;
    cached = Object.fromEntries(
      Object.entries(parsed).map(([dict, entry]) => [dict, ensureWordFsrs(entry)]),
    );
    return cached;
  } catch {
    return {};
  }
}

export function saveDeck(deck: KnowledgeMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(deck));
    cached = deck;
  } catch {
    // localStorage quota — keep the in-memory deck working.
  }
}

export function clearDeck(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cached = null;
}