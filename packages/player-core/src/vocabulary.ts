import type { Line, WordToken } from "@joylingo/shared";
import {
  extractKanji,
  type KanjiCardMap,
  type KanjiCardState,
  type KanjiProgress,
  type KanjiProgressMap,
  type KanjiStatus,
  type VocabularyClip,
  type VocabularyEntry,
  type VocabularyMap,
} from "@joylingo/shared";

const MAX_EXAMPLE_DICTS = 5;

export interface RecordEncounterInput {
  tok: WordToken;
  line: Line;
  episodeId: string;
  mined?: boolean;
}

/** Upsert a tap-logged vocabulary entry keyed by dictionary form. */
export function recordEncounter(
  input: RecordEncounterInput,
  store: VocabularyMap,
): VocabularyMap {
  const { tok, line, episodeId, mined } = input;
  const now = new Date().toISOString();
  const clip: VocabularyClip = { episodeId, lineId: line.id };
  const existing = store[tok.dict];

  if (existing) {
    return {
      ...store,
      [tok.dict]: {
        ...existing,
        reading: tok.r ?? tok.s,
        gloss: tok.gloss,
        surface: tok.s,
        tapCount: existing.tapCount + 1,
        mined: mined ?? existing.mined,
        lastSeenAt: now,
        lastClip: clip,
      },
    };
  }

  return {
    ...store,
    [tok.dict]: {
      dict: tok.dict,
      reading: tok.r ?? tok.s,
      gloss: tok.gloss,
      surface: tok.s,
      tapCount: 1,
      mined: mined ?? false,
      firstSeenAt: now,
      lastSeenAt: now,
      firstClip: clip,
      lastClip: clip,
    },
  };
}

/** Mark a vocabulary entry as mined (added to the learning deck). */
export function markMined(dict: string, store: VocabularyMap): VocabularyMap {
  const entry = store[dict];
  if (!entry) return store;
  return { ...store, [dict]: { ...entry, mined: true } };
}

function upsertKanjiProgress(
  map: KanjiProgressMap,
  char: string,
  dict: string,
  tapCount: number,
  seenAt: string,
): KanjiProgressMap {
  const existing = map[char];
  const examples = existing?.exampleDicts ?? [];
  const exampleDicts = examples.includes(dict)
    ? examples
    : [dict, ...examples].slice(0, MAX_EXAMPLE_DICTS);

  if (existing) {
    return {
      ...map,
      [char]: {
        ...existing,
        encounterCount: existing.encounterCount + tapCount,
        exampleDicts,
        lastSeenAt: seenAt,
      },
    };
  }

  return {
    ...map,
    [char]: {
      char,
      encounterCount: tapCount,
      exampleDicts,
      status: "seen",
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    },
  };
}

/** Derive per-kanji progress from the vocabulary encounter map. */
export function deriveKanjiProgress(vocabulary: VocabularyMap): KanjiProgressMap {
  let progress: KanjiProgressMap = {};

  for (const entry of Object.values(vocabulary)) {
    const chars = new Set([
      ...extractKanji(entry.dict),
      ...extractKanji(entry.surface),
    ]);
    for (const char of chars) {
      progress = upsertKanjiProgress(
        progress,
        char,
        entry.dict,
        entry.tapCount,
        entry.lastSeenAt,
      );
    }
  }

  return progress;
}

export function setKanjiStatus(
  progress: KanjiProgressMap,
  char: string,
  status: KanjiStatus,
): KanjiProgressMap {
  const entry = progress[char];
  if (!entry) return progress;
  return { ...progress, [char]: { ...entry, status } };
}

export function vocabularyList(
  vocabulary: VocabularyMap,
  opts?: { mined?: boolean; sort?: "recent" | "alpha" },
): VocabularyEntry[] {
  let list = Object.values(vocabulary);
  if (opts?.mined === true) list = list.filter((e) => e.mined);
  if (opts?.mined === false) list = list.filter((e) => !e.mined);
  if (opts?.sort === "alpha") {
    list.sort((a, b) => a.dict.localeCompare(b.dict, "ja"));
  } else {
    list.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }
  return list;
}

export function kanjiProgressList(
  progress: KanjiProgressMap,
  opts?: { status?: KanjiStatus; minEncounters?: number },
): KanjiProgress[] {
  let list = Object.values(progress);
  if (opts?.status) list = list.filter((p) => p.status === opts.status);
  if (opts?.minEncounters != null) {
    list = list.filter((p) => p.encounterCount >= opts.minEncounters!);
  }
  list.sort((a, b) => b.encounterCount - a.encounterCount);
  return list;
}

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

/** Seed kanji SRS cards from progress (encounter_count >= 2, not known). */
export function seedKanjiCards(
  progress: KanjiProgressMap,
  existing: KanjiCardMap = {},
): KanjiCardMap {
  const out = { ...existing };
  const now = new Date().toISOString();

  for (const entry of Object.values(progress)) {
    if (entry.encounterCount < 2 || entry.status === "known") continue;
    if (out[entry.char]) continue;
    out[entry.char] = {
      char: entry.char,
      intervalDays: 0,
      repetitions: 0,
      dueAt: now,
      lastReviewedAt: null,
    };
  }

  return out;
}

export function dueKanjiCards(
  cards: KanjiCardMap,
  now = new Date(),
): KanjiCardState[] {
  const t = now.toISOString();
  return Object.values(cards)
    .filter((c) => c.dueAt <= t)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** Merge device-local and API vocabulary maps (higher tap count / newer wins; mined is sticky). */
export function mergeVocabularyMaps(local: VocabularyMap, remote: VocabularyMap): VocabularyMap {
  const out: VocabularyMap = { ...local };
  for (const [dict, remoteEntry] of Object.entries(remote)) {
    const localEntry = out[dict];
    if (!localEntry) {
      out[dict] = remoteEntry;
      continue;
    }
    const remoteNewer = remoteEntry.lastSeenAt.localeCompare(localEntry.lastSeenAt) > 0;
    const pickRemote =
      remoteEntry.tapCount > localEntry.tapCount ||
      (remoteEntry.tapCount === localEntry.tapCount && remoteNewer);
    if (pickRemote) {
      out[dict] = { ...remoteEntry, mined: localEntry.mined || remoteEntry.mined };
    } else {
      out[dict] = {
        ...localEntry,
        mined: localEntry.mined || remoteEntry.mined,
        tapCount: Math.max(localEntry.tapCount, remoteEntry.tapCount),
      };
    }
  }
  return out;
}

/** Entries the client should push to the API after a bidirectional merge. */
export function vocabularyEntriesNeedingPush(
  local: VocabularyMap,
  remote: VocabularyMap,
  merged: VocabularyMap,
): VocabularyEntry[] {
  const pushes: VocabularyEntry[] = [];
  for (const dict of Object.keys(merged)) {
    const localEntry = local[dict];
    if (!localEntry) continue;

    const remoteEntry = remote[dict];
    const mergedEntry = merged[dict]!;

    if (!remoteEntry) {
      pushes.push(mergedEntry);
      continue;
    }

    const remoteNewer = remoteEntry.lastSeenAt.localeCompare(localEntry.lastSeenAt) > 0;
    const localWins =
      localEntry.tapCount > remoteEntry.tapCount ||
      (localEntry.tapCount === remoteEntry.tapCount && !remoteNewer);

    if (localWins) {
      pushes.push(mergedEntry);
    } else if (mergedEntry.mined && !remoteEntry.mined) {
      pushes.push(mergedEntry);
    }
  }
  return pushes;
}

/** Grade a kanji card: Again resets interval; Good doubles it (FSRS-lite). */
export function gradeKanjiCard(
  card: KanjiCardState,
  good: boolean,
  now = new Date(),
): KanjiCardState {
  const reviewedAt = now.toISOString();
  if (!good) {
    return {
      ...card,
      intervalDays: 0,
      repetitions: 0,
      dueAt: reviewedAt,
      lastReviewedAt: reviewedAt,
    };
  }
  const intervalDays = card.repetitions === 0 ? 1 : Math.min(card.intervalDays * 2 || 1, 60);
  return {
    ...card,
    intervalDays,
    repetitions: card.repetitions + 1,
    dueAt: addDays(reviewedAt, intervalDays),
    lastReviewedAt: reviewedAt,
  };
}
