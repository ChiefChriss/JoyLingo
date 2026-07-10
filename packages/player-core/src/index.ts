export type { PlayerAdapter } from "./PlayerAdapter.js";
export { MockPlayerAdapter } from "./adapters/MockPlayerAdapter.js";
export { YouTubePlayerAdapter } from "./adapters/YouTubePlayerAdapter.js";
export { HtmlVideoPlayerAdapter } from "./adapters/HtmlVideoPlayerAdapter.js";
export { usePlaybackClock } from "./usePlaybackClock.js";
export type { PlaybackClock } from "./usePlaybackClock.js";
export type { EpisodeSource, AnimeStreamBinding, SubtitleSourceKind } from "./EpisodeSource.js";
export { findActiveLine } from "./findActiveLine.js";
export {
  lineText,
  mineEntry,
  toDeck,
  wordClipBounds,
  attachWordReviewClips,
  resolveVocabularyClipRef,
} from "./deck.js";
export type {
  DeckCard,
  KnowledgeEntry,
  KnowledgeMap,
  KnowledgeStatus,
  ReviewClipRef,
  ReviewDeckCard,
} from "./deck.js";
export {
  ensureWordFsrs,
  gradeWordCard,
  isWordDue,
} from "./word-fsrs.js";
export type { StoredFsrsCard } from "./word-fsrs.js";
export {
  deriveKanjiProgress,
  dueKanjiCards,
  gradeKanjiCard,
  kanjiProgressList,
  markMined,
  mergeVocabularyMaps,
  vocabularyEntriesNeedingPush,
  recordEncounter,
  seedKanjiCards,
  setKanjiStatus,
  vocabularyList,
} from "./vocabulary.js";
export type { RecordEncounterInput } from "./vocabulary.js";
export {
  dueFusionCards,
  fusionDistractors,
  gradeFusionCard,
  shuffleChoices,
} from "./fusion.js";
