/**
 * EDU short-lesson (section) progress + practice-gate models.
 * Sections are H2 headings within mega-lessons 01–07.
 */
import type { EduLessonId } from "./skill-assessment.js";

export type EduSectionId = string; // e.g. "02:lesson-1-x-wa-y-desu"

export type EduSectionKind = "content" | "summary" | "self_check";

/** School-grade section mastery statuses. */
export type EduSectionStatus =
  | "not_started"
  | "in_progress"
  | "mastered"
  | "due"
  /** @deprecated legacy — migrated to in_progress */
  | "passed"
  | "available"
  | "locked";

/** Required stages for short-lesson mastery (school-grade). */
export type PracticeStage =
  | "listening"
  | "checkpoint"
  | "production"
  | "speaking"
  | "writing";

export const SECTION_MASTERY_STAGES: PracticeStage[] = [
  "listening",
  "checkpoint",
  "production",
  "speaking",
];

/** First-try accuracy required per graded stage. */
export const SCHOOL_PASS_SCORE = 0.85;
/** Unit-exam per-skill floor (JLPT-style). */
export const UNIT_BLOCK_FLOOR = 0.7;
/** Unit-exam overall pass. */
export const UNIT_OVERALL_PASS = 0.85;
/** Minimum speaking duration as fraction of target seconds. */
export const SPEAK_MIN_DURATION_RATIO = 0.5;

export interface EduSection {
  id: EduSectionId;
  lessonId: EduLessonId;
  slug: string;
  title: string;
  order: number;
  kind: EduSectionKind;
  practiceable: boolean;
}

export interface EduSectionProgress {
  status: EduSectionStatus;
  /** Stages completed in the current mastery cycle. */
  stagesCompleted: PracticeStage[];
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
  /** @deprecated use masteredAt */
  passedAt?: string;
}

export const DEFAULT_SECTION_PROGRESS: EduSectionProgress = {
  status: "not_started",
  stagesCompleted: [],
  attempts: 0,
  bestScore: 0,
  bestListeningScore: 0,
  bestCheckpointScore: 0,
  bestProductionScore: 0,
  speakingPassed: false,
};

/** Practice item kinds supported by the section gate engine. */
export type PracticeItemType =
  | "choice"
  | "cloze"
  | "reading"
  | "produce"
  | "produce_ja"
  | "conjugate"
  | "translate_en"
  | "listen_choice"
  | "listen_cloze"
  | "speak_prompt"
  | "write_prompt";

export interface PracticeItem {
  id: string;
  type: PracticeItemType;
  /** Which school stage this item belongs to. */
  stage?: PracticeStage;
  /** Main prompt shown to the learner. */
  prompt: string;
  /** Canonical correct answer. */
  answer: string;
  /** Extra acceptable answers (normalized compare). */
  accept?: string[];
  /** MC choices (for choice/cloze). */
  choices?: string[];
  /** Optional hint after a miss. */
  hint?: string;
  /** Optional short explanation after answer. */
  explain?: string;
  /** Japanese line for TTS listening. */
  promptJa?: string;
  /** Optional static audio URL. */
  audioUrl?: string;
  /** Target speak duration seconds. */
  speakSeconds?: number;
  /** Required self-grade checklist for speaking. */
  speakChecklist?: string[];
}

export interface PracticeSet {
  sectionId: EduSectionId;
  kind: "kana" | "grammar" | "vocab" | "mixed" | "general";
  passScore: number;
  items: PracticeItem[];
  /** When set, modal runs stages in SECTION_MASTERY_STAGES order. */
  staged?: Partial<Record<PracticeStage, PracticeItem[]>>;
}

export interface PracticeAttemptResult {
  itemId: string;
  correct: boolean;
  userAnswer: string;
}

export interface PracticeSessionState {
  sectionId: EduSectionId;
  passScore: number;
  /** Remaining queue (includes re-queued misses). */
  queue: PracticeItem[];
  /** How many times each item was answered correctly in this session. */
  correctOnce: Record<string, boolean>;
  /** Graded first attempts (unique items). */
  firstAttempts: PracticeAttemptResult[];
  totalAttempts: number;
  correctAttempts: number;
  finished: boolean;
  passed: boolean;
}

/** Strip emoji / decorative symbols for stable titles & slugs (never strip kana/kanji). */
export function cleanHeadingTitle(raw: string): string {
  return raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[📐📖🗣️✍️🎯🧠✅📝🀄🔤⚠️🧪📊🏢👑🙇🎎]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifySectionTitle(title: string): string {
  const cleaned = cleanHeadingTitle(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = cleaned
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "section";
}

export function makeSectionId(lessonId: EduLessonId, slug: string): EduSectionId {
  return `${lessonId}:${slug}`;
}

export function classifySectionKind(title: string): EduSectionKind {
  const t = title.toLowerCase();
  if (/self[- ]?check|self assessment|assessment/i.test(title)) return "self_check";
  if (/summary|quick reference|quick-reference/i.test(title)) return "summary";
  if (/about |how to use|learning pathway|structure/i.test(t)) return "content";
  return "content";
}

/**
 * Extract H2 sections from lesson markdown.
 * Does not include the document H1.
 */
export function parseSectionsFromMarkdown(
  md: string,
  lessonId: EduLessonId,
): EduSection[] {
  const lines = md.split(/\r?\n/);
  const sections: EduSection[] = [];
  const seenSlugs = new Map<string, number>();

  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line);
    if (!m) continue;
    const rawTitle = m[1]!.trim();
    const title = cleanHeadingTitle(rawTitle) || rawTitle;
    let slug = slugifySectionTitle(rawTitle);
    const n = (seenSlugs.get(slug) ?? 0) + 1;
    seenSlugs.set(slug, n);
    if (n > 1) slug = `${slug}-${n}`;

    const kind = classifySectionKind(title);
    sections.push({
      id: makeSectionId(lessonId, slug),
      lessonId,
      slug,
      title,
      order: sections.length,
      kind,
      practiceable: true,
    });
  }

  return sections;
}

/**
 * Parse ```joylingo-practice ... ``` fences as JSON PracticeSet payloads
 * (without sectionId — caller attaches nearest preceding H2).
 */
export function parsePracticeFences(md: string): Array<{
  afterHeadingIndex: number;
  set: Omit<PracticeSet, "sectionId"> & { sectionId?: string };
}> {
  const headingIndices: number[] = [];
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]!)) headingIndices.push(i);
  }

  const out: Array<{
    afterHeadingIndex: number;
    set: Omit<PracticeSet, "sectionId"> & { sectionId?: string };
  }> = [];

  const fenceRe = /```joylingo-practice\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(md)) !== null) {
    const body = match[1]!.trim();
    const start = match.index;
    // Map char offset to line roughly via prefix length
    const prefix = md.slice(0, start);
    const lineNo = prefix.split(/\r?\n/).length - 1;
    let headingIdx = -1;
    for (let h = headingIndices.length - 1; h >= 0; h--) {
      if (headingIndices[h]! <= lineNo) {
        headingIdx = h;
        break;
      }
    }
    try {
      const parsed = JSON.parse(body) as Partial<PracticeSet> & {
        items?: PracticeItem[];
      };
      if (!Array.isArray(parsed.items) || parsed.items.length === 0) continue;
      const items = parsed.items.map((it, i) => normalizePracticeItem(it, i));
      out.push({
        afterHeadingIndex: headingIdx,
        set: {
          kind: parsed.kind ?? "general",
          passScore:
            typeof parsed.passScore === "number" && parsed.passScore > 0
              ? parsed.passScore
              : 0.8,
          items,
        },
      });
    } catch {
      // skip invalid fence
    }
  }
  return out;
}

function normalizePracticeItem(raw: PracticeItem, index: number): PracticeItem {
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `item-${index}`,
    type: raw.type ?? "choice",
    prompt: String(raw.prompt ?? ""),
    answer: String(raw.answer ?? ""),
    accept: Array.isArray(raw.accept) ? raw.accept.map(String) : undefined,
    choices: Array.isArray(raw.choices) ? raw.choices.map(String) : undefined,
    hint: raw.hint ? String(raw.hint) : undefined,
    explain: raw.explain ? String(raw.explain) : undefined,
  };
}

/** Bind practice fences to sections by H2 order. */
export function bindPracticeToSections(
  sections: EduSection[],
  fences: ReturnType<typeof parsePracticeFences>,
): Map<EduSectionId, PracticeSet> {
  const map = new Map<EduSectionId, PracticeSet>();
  for (const f of fences) {
    if (f.afterHeadingIndex < 0 || f.afterHeadingIndex >= sections.length) continue;
    const section = sections[f.afterHeadingIndex]!;
    map.set(section.id, {
      sectionId: section.id,
      kind: f.set.kind,
      passScore: f.set.passScore,
      items: f.set.items,
    });
  }
  return map;
}

/** Normalize free-text answers for produce/translate comparison. */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。．.！!？?、,，]/g, "")
    .replace(/[ー−–—]/g, "ー");
}

/** Common Hepburn / kunrei romaji aliases for kana reading checks. */
function romajiVariants(s: string): string[] {
  const base = normalizeAnswer(s);
  const alts = new Set<string>([base]);
  const swap: [RegExp, string][] = [
    [/shi/g, "si"],
    [/si/g, "shi"],
    [/chi/g, "ti"],
    [/ti/g, "chi"],
    [/tsu/g, "tu"],
    [/tu/g, "tsu"],
    [/fu/g, "hu"],
    [/hu/g, "fu"],
    [/ji/g, "zi"],
    [/zi/g, "ji"],
    [/sha/g, "sya"],
    [/shu/g, "syu"],
    [/sho/g, "syo"],
    [/cha/g, "tya"],
    [/chu/g, "tyu"],
    [/cho/g, "tyo"],
  ];
  for (const [re, rep] of swap) {
    if (re.test(base)) alts.add(base.replace(re, rep));
  }
  return [...alts];
}

export function answersMatch(user: string, item: PracticeItem): boolean {
  const u = normalizeAnswer(user);
  if (!u) return false;
  const candidates = [item.answer, ...(item.accept ?? [])];
  if (item.type === "reading") {
    const userVars = romajiVariants(user);
    return candidates.some((c) => {
      const ansVars = romajiVariants(c);
      return userVars.some((uv) => ansVars.includes(uv));
    });
  }
  return candidates.some((c) => normalizeAnswer(c) === u);
}

export function createPracticeSession(
  set: PracticeSet,
  stage?: PracticeStage,
): PracticeSessionState {
  const items = stage ? itemsForStage(set, stage) : set.items;
  return {
    sectionId: set.sectionId,
    passScore: set.passScore || SCHOOL_PASS_SCORE,
    queue: [...items],
    correctOnce: {},
    firstAttempts: [],
    totalAttempts: 0,
    correctAttempts: 0,
    finished: false,
    passed: false,
  };
}

/**
 * Grade one answer. On miss, re-queue the item ~3 places later.
 *
 * Pass requires:
 * 1. Every unique item answered correctly at least once (miss queue cleared)
 * 2. First-attempt accuracy ≥ passScore (school default 0.85)
 *
 * If the queue is cleared but first-attempt accuracy is below threshold,
 * the session finishes as failed — learner must retry the full set.
 */
export function gradePracticeAnswer(
  state: PracticeSessionState,
  userAnswer: string,
): { next: PracticeSessionState; correct: boolean; item: PracticeItem | null } {
  if (state.finished || state.queue.length === 0) {
    return { next: state, correct: false, item: null };
  }
  const item = state.queue[0]!;
  const rest = state.queue.slice(1);
  const correct = answersMatch(userAnswer, item);

  const firstAttempts = [...state.firstAttempts];
  if (!firstAttempts.some((a) => a.itemId === item.id)) {
    firstAttempts.push({ itemId: item.id, correct, userAnswer });
  }

  const correctOnce = { ...state.correctOnce };
  if (correct) correctOnce[item.id] = true;

  let queue = rest;
  if (!correct) {
    const insertAt = Math.min(2, rest.length);
    queue = [...rest.slice(0, insertAt), item, ...rest.slice(insertAt)];
  }

  const totalAttempts = state.totalAttempts + 1;
  const correctAttempts = state.correctAttempts + (correct ? 1 : 0);

  const knownIds = new Set<string>([
    ...firstAttempts.map((a) => a.itemId),
    ...queue.map((q) => q.id),
    ...Object.keys(correctOnce),
  ]);
  const uniqueTotal = knownIds.size;
  const allMastered =
    uniqueTotal > 0 &&
    queue.length === 0 &&
    [...knownIds].every((id) => correctOnce[id]);

  const firstCorrect = firstAttempts.filter((a) => a.correct).length;
  const firstRate =
    firstAttempts.length === 0 ? 0 : firstCorrect / firstAttempts.length;

  const passed = allMastered && firstRate >= state.passScore;
  const finished = allMastered;

  const next: PracticeSessionState = {
    sectionId: state.sectionId,
    passScore: state.passScore,
    queue,
    correctOnce,
    firstAttempts,
    totalAttempts,
    correctAttempts,
    finished,
    passed,
  };

  return { next, correct, item };
}

export function practiceSessionScore(state: PracticeSessionState): number {
  if (state.firstAttempts.length === 0) return 0;
  const c = state.firstAttempts.filter((a) => a.correct).length;
  return c / state.firstAttempts.length;
}

/** True if section currently counts as fully mastered (not due). */
export function isSectionMastered(
  progress: Record<string, EduSectionProgress>,
  sectionId: EduSectionId,
): boolean {
  const p = progress[sectionId];
  if (!p) return false;
  if (p.status === "mastered") return true;
  // Legacy soft pass does NOT count as school mastery
  return false;
}

export function isSectionDue(
  progress: Record<string, EduSectionProgress>,
  sectionId: EduSectionId,
  now = Date.now(),
): boolean {
  const p = progress[sectionId];
  if (!p) return false;
  if (p.status === "due") return true;
  if (p.status === "mastered" && p.dueAt) {
    return new Date(p.dueAt).getTime() <= now;
  }
  return false;
}

export function countPassedSections(
  sections: EduSection[],
  progress: Record<string, EduSectionProgress>,
): { passed: number; total: number; pct: number } {
  const practiceable = sections.filter((s) => s.practiceable);
  const total = practiceable.length;
  const passed = practiceable.filter((s) =>
    isSectionMastered(progress, s.id),
  ).length;
  return {
    passed,
    total,
    pct: total === 0 ? 0 : Math.round((passed / total) * 100),
  };
}

export function allSectionsPassed(
  sections: EduSection[],
  progress: Record<string, EduSectionProgress>,
): boolean {
  const practiceable = sections.filter((s) => s.practiceable);
  if (practiceable.length === 0) return false;
  return practiceable.every(
    (s) => isSectionMastered(progress, s.id) && !isSectionDue(progress, s.id),
  );
}

export function getSectionProgress(
  progress: Record<string, EduSectionProgress>,
  sectionId: EduSectionId,
): EduSectionProgress {
  return progress[sectionId] ?? { ...DEFAULT_SECTION_PROGRESS };
}

export function sectionHasFullMasteryStages(p: EduSectionProgress): boolean {
  return SECTION_MASTERY_STAGES.every((st) => p.stagesCompleted.includes(st));
}

/** Next mastery interval days after a successful retest (5 → 10 → 21). */
export function nextMasteryIntervalDays(prevDays?: number): number {
  if (!prevDays || prevDays < 5) return 5;
  if (prevDays < 10) return 10;
  return 21;
}

export function itemsForStage(
  set: PracticeSet,
  stage: PracticeStage,
): PracticeItem[] {
  if (set.staged?.[stage]?.length) return set.staged[stage]!;
  return set.items.filter((i) => (i.stage ?? "checkpoint") === stage);
}
