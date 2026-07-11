/** Skill level placement test — types, scoring, recommendations. */
export type SkillSectionId = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type SkillChoiceId = "a" | "b" | "c" | "d";
/** User answer: a choice or explicit "don't know" (no false-positive credit). */
export type SkillAnswer = SkillChoiceId | "unknown";

export interface SkillSectionMeta {
  label: string;
  jlpt: string;
  max: number;
}

export interface SkillQuestionOption {
  id: SkillChoiceId;
  text: string;
}

export interface SkillQuestion {
  id: string;
  section: SkillSectionId;
  prompt: string;
  options: SkillQuestionOption[];
  correct: SkillChoiceId;
  passage?: string;
}

export interface SkillSectionScore {
  section: SkillSectionId;
  correct: number;
  max: number;
  /** Questions answered with "don't know" — excluded from guessing inflation. */
  skipped: number;
}

export interface PlacementResult {
  totalScore: number;
  maxScore: number;
  sectionScores: SkillSectionScore[];
  recommendedLessonId: EduLessonId;
  levelLabel: string;
  levelDetail: string;
  completedAt: string;
  answers: Record<string, SkillAnswer>;
}

export type EduLessonId =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07";

export interface EduLesson {
  id: EduLessonId;
  slug: string;
  file: string;
  title: string;
  titleJa: string;
  source: string;
  jlpt: string;
  hours: string;
  prerequisite?: string;
  order: number;
}

export const EDU_LESSONS: EduLesson[] = [
  {
    id: "01",
    slug: "01-kana-basics",
    file: "01_kana_basics.md",
    title: "Kana Basics",
    titleJa: "仮名の基礎",
    source: "Pre-Genki",
    jlpt: "Pre-N5",
    hours: "15–30",
    order: 1,
  },
  {
    id: "02",
    slug: "02-genki1-grammar",
    file: "02_genki1_grammar.md",
    title: "Genki I Grammar",
    titleJa: "げんき I 文法",
    source: "Genki I · Lessons 1–12",
    jlpt: "N5",
    hours: "60–90",
    prerequisite: "Kana literacy",
    order: 2,
  },
  {
    id: "03",
    slug: "03-genki1-vocab-kanji",
    file: "03_genki1_vocab_kanji.md",
    title: "Genki I Vocab & Kanji",
    titleJa: "げんき I 単語・漢字",
    source: "Genki I",
    jlpt: "N5",
    hours: "30–50",
    prerequisite: "Genki I grammar",
    order: 3,
  },
  {
    id: "04",
    slug: "04-genki2-grammar",
    file: "04_genki2_grammar.md",
    title: "Genki II Grammar",
    titleJa: "げんき II 文法",
    source: "Genki II · Lessons 13–23",
    jlpt: "N4",
    hours: "60–90",
    prerequisite: "Genki I complete",
    order: 4,
  },
  {
    id: "05",
    slug: "05-genki2-vocab-kanji",
    file: "05_genki2_vocab_kanji.md",
    title: "Genki II Vocab & Kanji",
    titleJa: "げんき II 単語・漢字",
    source: "Genki II",
    jlpt: "N4",
    hours: "30–50",
    prerequisite: "Genki II grammar",
    order: 5,
  },
  {
    id: "06",
    slug: "06-tobira-grammar",
    file: "06_tobira_grammar.md",
    title: "Tobira Grammar",
    titleJa: "とびら 文法",
    source: "Tobira · Advanced patterns",
    jlpt: "N3/N2",
    hours: "80–120",
    prerequisite: "Genki II complete",
    order: 6,
  },
  {
    id: "07",
    slug: "07-keigo",
    file: "07_keigo.md",
    title: "Keigo",
    titleJa: "敬語",
    source: "Honorific & humble language",
    jlpt: "N3+",
    hours: "15–25",
    prerequisite: "Tobira grammar",
    order: 7,
  },
];

export const EDU_LESSON_BY_ID = Object.fromEntries(
  EDU_LESSONS.map((l) => [l.id, l]),
) as Record<EduLessonId, EduLesson>;

export const EDU_LESSON_BY_SLUG = Object.fromEntries(
  EDU_LESSONS.map((l) => [l.slug, l]),
) as Record<string, EduLesson>;

export type EduPracticeStage =
  | "listening"
  | "checkpoint"
  | "production"
  | "speaking"
  | "writing";

export interface EduSectionProgressEntry {
  status:
    | "not_started"
    | "in_progress"
    | "mastered"
    | "due"
    | "passed"
    | "available"
    | "locked";
  stagesCompleted: EduPracticeStage[];
  attempts: number;
  bestScore: number;
  bestListeningScore: number;
  bestCheckpointScore: number;
  bestProductionScore: number;
  speakingPassed: boolean;
  speakingRecordingMeta?: { at: string; durationSec: number };
  lastScore?: number;
  masteredAt?: string;
  dueAt?: string;
  passedAt?: string;
}

export interface EduUnitExamResult {
  lessonId: EduLessonId;
  overall: number;
  blockScores: {
    listening: number;
    production: number;
    recognition: number;
    writing: number;
    speaking: boolean;
  };
  passedAt: string;
  dueAt?: string;
}

export interface EduCurriculumProgress {
  completedLessonIds: EduLessonId[];
  currentLessonId: EduLessonId | null;
  placement?: PlacementResult;
  /** Per short-lesson (H2 section) practice-gate progress. */
  sectionProgress: Record<string, EduSectionProgressEntry>;
  currentSectionId?: string;
  /** Unit exams — required for mega-lesson complete under school rules. */
  unitExams?: Partial<Record<EduLessonId, EduUnitExamResult>>;
  /** Schema version for migrations (2 = school-grade stages). */
  schemaVersion?: number;
  standardsBannerSeen?: boolean;
}

export const DEFAULT_EDU_PROGRESS: EduCurriculumProgress = {
  completedLessonIds: [],
  currentLessonId: "01",
  sectionProgress: {},
  unitExams: {},
  schemaVersion: 2,
};

/** Score answers: only explicit correct choices earn a point; unknown = 0. */
export function scorePlacement(
  questions: SkillQuestion[],
  answers: Record<string, SkillAnswer>,
): Omit<PlacementResult, "completedAt"> {
  const sectionMap = new Map<SkillSectionId, SkillSectionScore>();
  let totalScore = 0;

  for (const q of questions) {
    const entry = sectionMap.get(q.section) ?? {
      section: q.section,
      correct: 0,
      max: 0,
      skipped: 0,
    };
    entry.max += 1;
    const ans = answers[q.id];
    if (ans === "unknown" || ans === undefined) {
      if (ans === "unknown") entry.skipped += 1;
    } else if (ans === q.correct) {
      entry.correct += 1;
      totalScore += 1;
    }
    sectionMap.set(q.section, entry);
  }

  const sectionScores = [...sectionMap.values()].sort((a, b) =>
    a.section.localeCompare(b.section),
  );
  const { recommendedLessonId, levelLabel, levelDetail } = recommendLevel(totalScore, sectionScores);

  return {
    totalScore,
    maxScore: questions.length,
    sectionScores,
    recommendedLessonId,
    levelLabel,
    levelDetail,
    answers,
  };
}

/** Map total score to recommended starting lesson (from skill_level.md). */
export function recommendLevel(
  total: number,
  sections: SkillSectionScore[],
): { recommendedLessonId: EduLessonId; levelLabel: string; levelDetail: string } {
  const bySection = Object.fromEntries(sections.map((s) => [s.section, s])) as Partial<
    Record<SkillSectionId, SkillSectionScore>
  >;
  const a = bySection.A?.correct ?? 0;
  const b = bySection.B?.correct ?? 0;
  const c = bySection.C?.correct ?? 0;
  const d = bySection.D?.correct ?? 0;
  const e = bySection.E?.correct ?? 0;
  const f = bySection.F?.correct ?? 0;

  if (total <= 10) {
    return {
      recommendedLessonId: "01",
      levelLabel: "Absolute Beginner (Pre-N5)",
      levelDetail: "Start with hiragana and katakana before grammar.",
    };
  }
  if (total <= 22) {
    return {
      recommendedLessonId: "02",
      levelLabel: "Beginner (Low N5)",
      levelDetail: "Begin Genki I from Lesson 1.",
    };
  }
  if (total <= 32) {
    return {
      recommendedLessonId: "02",
      levelLabel: "False Beginner (High N5)",
      levelDetail: "Skim Genki I Lessons 1–5, then study from Lesson 6.",
    };
  }
  if (total <= 42) {
    return {
      recommendedLessonId: "04",
      levelLabel: "Elementary (N4)",
      levelDetail: "Genki I is solid — move to Genki II grammar.",
    };
  }
  if (total <= 50) {
    return {
      recommendedLessonId: "06",
      levelLabel: "Intermediate (High N4 / Low N3)",
      levelDetail: "Core grammar is strong — tackle Tobira advanced patterns.",
    };
  }
  if (total <= 56) {
    return {
      recommendedLessonId: "06",
      levelLabel: "Upper Intermediate (N3)",
      levelDetail: "Polish Tobira grammar, then study keigo in Lesson 07.",
    };
  }

  // Nuanced overrides from section gaps
  if (a + b + c >= 20 && d < 6) {
    return {
      recommendedLessonId: "04",
      levelLabel: "N4 gap (passive / causative)",
      levelDetail: "Strong foundation but intermediate grammar needs work — start Genki II.",
    };
  }
  if (a + b + c + d >= 30 && e < 5) {
    return {
      recommendedLessonId: "06",
      levelLabel: "N3 gap (advanced patterns)",
      levelDetail: "N4 base is good — move to Tobira grammar.",
    };
  }
  if (e + d >= 14 && f < 4) {
    return {
      recommendedLessonId: "07",
      levelLabel: "Keigo focus",
      levelDetail: "Grammar is strong but formal language needs dedicated study.",
    };
  }

  return {
    recommendedLessonId: "07",
    levelLabel: "Advanced (N2+)",
    levelDetail: "Ready for native content — focus on keigo mastery.",
  };
}

export { SKILL_QUESTIONS, SKILL_SECTIONS } from "./skill-assessment-data.js";
