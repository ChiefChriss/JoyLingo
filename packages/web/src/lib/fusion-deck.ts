/** Client-side fusion deck mirror (best-effort API sync). */
import type { ClipCandidate, FusionCard, FusionCardMap } from "@joylingo/shared";

const STORAGE_KEY = "joylingo:fusion-deck";

export function loadFusionDeck(): FusionCardMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const list = JSON.parse(raw) as FusionCard[];
    return Object.fromEntries(list.map((c) => [c.id, c]));
  } catch {
    return {};
  }
}

export function saveFusionDeck(map: FusionCardMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(map)));
}

export function mergeFusionCards(map: FusionCardMap, cards: FusionCard[]): FusionCardMap {
  const next = { ...map };
  for (const c of cards) next[c.id] = c;
  return next;
}

export function candidateKey(c: ClipCandidate): string {
  return `${c.curriculumWordId}:${c.episodeId}:${c.lineId}`;
}
