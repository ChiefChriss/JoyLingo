/** Static hybrid curriculum definition shared by web (and later mobile). */
import type { JlptGoal, UserProfile, VocabularyMap } from "./index.js";

export type StepId = "kana" | "immersion" | "mine" | "review" | "jlpt";

export interface CurriculumStep {
  id: StepId;
  title: string;
  detail: string;
  /** Optional deep-link route the CTA navigates to. */
  ctaLink?: string;
  /** Label for the CTA button. */
  ctaLabel: string;
}

export interface CurriculumProgress {
  currentStepId: StepId;
  completedStepIds: StepId[];
  episodeIdForPath?: string;
}

export const DEFAULT_CURRICULUM_PROGRESS: CurriculumProgress = {
  currentStepId: "kana",
  completedStepIds: [],
};

export const STEP_ORDER: StepId[] = ["kana", "immersion", "mine", "review", "jlpt"];

/** Static step metadata; runtime gating lives in `getNextStep`. */
export const STEP_META: Record<StepId, CurriculumStep> = {
  kana: {
    id: "kana",
    title: "Kana basics",
    detail: "Complete stages 1–2 (hiragana) with ≥80% on vowels + k/s/t rows, or mark known.",
    ctaLink: "/learn/kana",
    ctaLabel: "Open kana tools",
  },
  immersion: {
    id: "immersion",
    title: "First immersion",
    detail: "Enrich & watch an episode from one of your favorite anime.",
    ctaLabel: "Pick an episode",
  },
  mine: {
    id: "mine",
    title: "Mine 10 words",
    detail: "Tap subtitle words and add at least 10 to your deck from that episode.",
    ctaLabel: "Open player",
  },
  review: {
    id: "review",
    title: "Review",
    detail: "Complete one word review session (and one kanji review, if any cards are due).",
    ctaLabel: "Start review",
  },
  jlpt: {
    id: "jlpt",
    title: "JLPT lens",
    detail: "Browse your kanji dashboard filtered by your JLPT goal.",
    ctaLink: "/kanji",
    ctaLabel: "Open kanji dashboard",
  },
};

/**
 * Kana step is satisfied when the user passes the onboarding check, or when
 * `KanaTools` records the threshold row and flips `profile.kanaBaselineDone`.
 */
export function isKanaStepComplete(profile: UserProfile): boolean {
  return Boolean(profile.kanaBaselineDone);
}

export function countMinedWords(vocabulary: VocabularyMap): number {
  return Object.values(vocabulary).filter((e) => e.mined).length;
}

export function countTappedWords(vocabulary: VocabularyMap): number {
  return Object.values(vocabulary).length;
}

/** Distinct episodes the learner has tapped words in. */
export function countEpisodesWatched(vocabulary: VocabularyMap): number {
  const ids = new Set<string>();
  for (const e of Object.values(vocabulary)) {
    ids.add(e.firstClip.episodeId);
    ids.add(e.lastClip.episodeId);
  }
  if (ids.size > 0) return ids.size;
  return 0;
}

interface NextStepInput {
  profile: UserProfile;
  progress: CurriculumProgress;
  vocabulary: VocabularyMap;
  /** Whether the user has watched at least one episode this session. */
  hasWatched: boolean;
  /** Whether the user completed at least one review this session. */
  hasReviewed: boolean;
}

/**
 * Decide the next incomplete step in the v1 hybrid path. The JLPT step is
 * skipped when `profile.jlptGoal` is null or `anime_only`.
 */
export function getNextStep(
  input: NextStepInput,
): { step: CurriculumStep; index: number; total: number; allDone: boolean } {
  const { profile, vocabulary, hasWatched, hasReviewed } = input;

  const steps: StepId[] = STEP_ORDER.filter((s) => {
    if (s === "jlpt" && (!profile.jlptGoal || profile.jlptGoal === "anime_only")) {
      return false;
    }
    return true;
  });
  const total = steps.length;

  const completed = new Set<StepId>(input.progress.completedStepIds);
  if (isKanaStepComplete(profile)) completed.add("kana");
  if (hasWatched) completed.add("immersion");
  if (countMinedWords(vocabulary) >= 10) completed.add("mine");
  if (hasReviewed) completed.add("review");

  const next = steps.find((s) => !completed.has(s)) ?? null;
  const allDone = next === null;
  const stepId = next ?? steps[steps.length - 1]!;
  const index = next ? steps.indexOf(next) : total - 1;
  return { step: STEP_META[stepId], index, total, allDone };
}

/** Whether a single path step is satisfied (persisted or live metrics). */
export function isStepDone(stepId: StepId, input: NextStepInput): boolean {
  const { profile, progress, vocabulary, hasWatched, hasReviewed } = input;
  if (progress.completedStepIds.includes(stepId)) return true;
  switch (stepId) {
    case "kana":
      return isKanaStepComplete(profile);
    case "immersion":
      return hasWatched;
    case "mine":
      return countMinedWords(vocabulary) >= 10;
    case "review":
      return hasReviewed;
    default:
      return false;
  }
}

/** Count completed steps in the active path (JLPT step omitted for anime_only). */
export function getPathCompletion(input: NextStepInput): {
  done: number;
  total: number;
  pct: number;
} {
  const { profile } = input;
  const steps = STEP_ORDER.filter((s) => {
    if (s === "jlpt" && (!profile.jlptGoal || profile.jlptGoal === "anime_only")) {
      return false;
    }
    return true;
  });
  const done = steps.filter((s) => isStepDone(s, input)).length;
  const total = steps.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export type GoalCategory = "foundation" | "vocabulary" | "kanji" | "immersion" | "jlpt";

export interface GoalMilestone {
  id: string;
  category: GoalCategory;
  title: string;
  detail: string;
  target: number;
  ctaLink?: string;
  ctaLabel?: string;
}

export interface GoalStatus extends GoalMilestone {
  current: number;
  done: boolean;
}

export interface LearningSnapshot {
  minedWords: number;
  tappedWords: number;
  kanjiEncountered: number;
  episodesWatched: number;
  kanaBaselineDone: boolean;
  hiraganaPct: number;
  katakanaPct: number;
  hasWatched: boolean;
  hasReviewed: boolean;
}

const FOUNDATION_GOALS: GoalMilestone[] = [
  {
    id: "kana_baseline",
    category: "foundation",
    title: "Kana baseline",
    detail: "Pass vowels + k/s/t rows at ≥80%, or mark known.",
    target: 1,
    ctaLink: "/learn/kana",
    ctaLabel: "Kana tools",
  },
  {
    id: "hiragana_80",
    category: "foundation",
    title: "Hiragana fluency",
    detail: "Reach ≥80% quiz accuracy across all hiragana.",
    target: 80,
    ctaLink: "/learn/kana",
    ctaLabel: "Practice hiragana",
  },
  {
    id: "katakana_80",
    category: "foundation",
    title: "Katakana fluency",
    detail: "Reach ≥80% quiz accuracy across all katakana.",
    target: 80,
    ctaLink: "/learn/kana",
    ctaLabel: "Practice katakana",
  },
];

const VOCAB_GOALS: GoalMilestone[] = [
  {
    id: "mine_10",
    category: "vocabulary",
    title: "First 10 words",
    detail: "Mine 10 words from subtitle taps.",
    target: 10,
    ctaLabel: "Pick an episode",
  },
  {
    id: "mine_50",
    category: "vocabulary",
    title: "50-word deck",
    detail: "Build a deck of 50 mined vocabulary.",
    target: 50,
  },
  {
    id: "mine_100",
    category: "vocabulary",
    title: "100-word deck",
    detail: "A solid foundation of 100 mined words.",
    target: 100,
  },
  {
    id: "mine_250",
    category: "vocabulary",
    title: "250-word deck",
    detail: "Intermediate immersion vocabulary size.",
    target: 250,
  },
];

const KANJI_GOALS: GoalMilestone[] = [
  {
    id: "kanji_10",
    category: "kanji",
    title: "10 kanji seen",
    detail: "Encounter 10 distinct kanji from your media.",
    target: 10,
    ctaLink: "/kanji",
    ctaLabel: "Kanji dashboard",
  },
  {
    id: "kanji_50",
    category: "kanji",
    title: "50 kanji seen",
    detail: "Growing kanji recognition from immersion.",
    target: 50,
    ctaLink: "/kanji",
    ctaLabel: "Kanji dashboard",
  },
  {
    id: "kanji_100",
    category: "kanji",
    title: "100 kanji seen",
    detail: "Strong kanji exposure from real content.",
    target: 100,
    ctaLink: "/kanji",
    ctaLabel: "Kanji dashboard",
  },
];

const IMMERSION_GOALS: GoalMilestone[] = [
  {
    id: "first_episode",
    category: "immersion",
    title: "First episode",
    detail: "Watch one enriched episode with interactive subs.",
    target: 1,
    ctaLabel: "Pick an episode",
  },
  {
    id: "first_review",
    category: "immersion",
    title: "First review",
    detail: "Complete one spaced-repetition review session.",
    target: 1,
    ctaLabel: "Start review",
  },
  {
    id: "episodes_5",
    category: "immersion",
    title: "5 episodes watched",
    detail: "Sustain immersion across multiple episodes.",
    target: 5,
    ctaLabel: "Pick an episode",
  },
];

/** JLPT-aligned long-term targets (approximate exam prep milestones). */
const JLPT_TARGETS: Record<Exclude<JlptGoal, "anime_only" | null>, { vocab: number; kanji: number }> = {
  N5: { vocab: 800, kanji: 80 },
  N4: { vocab: 1500, kanji: 300 },
  N3: { vocab: 3750, kanji: 650 },
  N2: { vocab: 6000, kanji: 1000 },
  N1: { vocab: 10000, kanji: 2000 },
};

function jlptGoals(goal: Exclude<JlptGoal, "anime_only" | null>): GoalMilestone[] {
  const t = JLPT_TARGETS[goal];
  return [
    {
      id: `jlpt_${goal.toLowerCase()}_vocab`,
      category: "jlpt",
      title: `${goal} vocabulary`,
      detail: `Mine ~${t.vocab.toLocaleString()} words toward ${goal} coverage.`,
      target: t.vocab,
    },
    {
      id: `jlpt_${goal.toLowerCase()}_kanji`,
      category: "jlpt",
      title: `${goal} kanji exposure`,
      detail: `Encounter ~${t.kanji.toLocaleString()} kanji from your media.`,
      target: t.kanji,
      ctaLink: "/kanji",
      ctaLabel: "Kanji dashboard",
    },
  ];
}

function goalCurrent(id: string, snap: LearningSnapshot, progress: CurriculumProgress): number {
  switch (id) {
    case "kana_baseline":
      return snap.kanaBaselineDone ? 1 : 0;
    case "hiragana_80":
      return snap.hiraganaPct;
    case "katakana_80":
      return snap.katakanaPct;
    case "mine_10":
    case "mine_50":
    case "mine_100":
    case "mine_250":
      return snap.minedWords;
    case "kanji_10":
    case "kanji_50":
    case "kanji_100":
      return snap.kanjiEncountered;
    case "first_episode":
      return snap.episodesWatched >= 1 ||
        snap.hasWatched ||
        progress.completedStepIds.includes("immersion")
        ? 1
        : 0;
    case "first_review":
      return snap.hasReviewed || progress.completedStepIds.includes("review") ? 1 : 0;
    case "episodes_5":
      return snap.episodesWatched;
    default:
      if (id.startsWith("jlpt_") && id.endsWith("_vocab")) return snap.minedWords;
      if (id.startsWith("jlpt_") && id.endsWith("_kanji")) return snap.kanjiEncountered;
      return 0;
  }
}

/** All active goals for the user's profile and current learning snapshot. */
export function evaluateGoals(
  profile: UserProfile,
  snap: LearningSnapshot,
  progress: CurriculumProgress,
): GoalStatus[] {
  const goals: GoalMilestone[] = [
    ...FOUNDATION_GOALS,
    ...IMMERSION_GOALS,
    ...VOCAB_GOALS,
    ...KANJI_GOALS,
  ];
  if (profile.jlptGoal && profile.jlptGoal !== "anime_only") {
    goals.push(...jlptGoals(profile.jlptGoal));
  }
  return goals.map((g) => {
    const current = goalCurrent(g.id, snap, progress);
    return { ...g, current, done: current >= g.target };
  });
}

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  foundation: "Foundation",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  immersion: "Immersion",
  jlpt: "JLPT goal",
};