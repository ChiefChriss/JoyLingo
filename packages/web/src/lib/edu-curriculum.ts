/** EDU_JAP curriculum progress (device-local) — school-grade mastery. */
import {
  DEFAULT_EDU_PROGRESS,
  DEFAULT_SECTION_PROGRESS,
  SECTION_MASTERY_STAGES,
  allSectionsPassed,
  countPassedSections,
  isSectionDue,
  isSectionMastered,
  nextMasteryIntervalDays,
  sectionHasFullMasteryStages,
  type EduCurriculumProgress,
  type EduLessonId,
  type EduSection,
  type EduSectionProgress,
  type EduUnitExamResult,
  type PlacementResult,
  type PracticeStage,
} from "@joylingo/shared";

const KEY = "joylingo:edu-curriculum";
const SCHEMA = 2;

function emptySection(): EduSectionProgress {
  return {
    ...DEFAULT_SECTION_PROGRESS,
    stagesCompleted: [],
  };
}

function normalizeSectionProgress(
  input: unknown,
): Record<string, EduSectionProgress> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, EduSectionProgress> = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Partial<EduSectionProgress> & { status?: string };
    // Strict migration: legacy "passed" does NOT grant mastery
    let status: EduSectionProgress["status"] = "not_started";
    if (p.status === "mastered") status = "mastered";
    else if (p.status === "due") status = "due";
    else if (p.status === "in_progress") status = "in_progress";
    else if (p.status === "passed" || p.status === "available" || p.status === "locked") {
      status = "in_progress"; // force re-earn under school rules
    }

    const stages = Array.isArray(p.stagesCompleted)
      ? p.stagesCompleted.filter((s): s is PracticeStage =>
          ["listening", "checkpoint", "production", "speaking", "writing"].includes(
            s as string,
          ),
        )
      : [];

    out[id] = {
      status,
      stagesCompleted: stages,
      attempts: typeof p.attempts === "number" ? p.attempts : 0,
      bestScore: typeof p.bestScore === "number" ? p.bestScore : 0,
      bestListeningScore:
        typeof p.bestListeningScore === "number" ? p.bestListeningScore : 0,
      bestCheckpointScore:
        typeof p.bestCheckpointScore === "number" ? p.bestCheckpointScore : 0,
      bestProductionScore:
        typeof p.bestProductionScore === "number" ? p.bestProductionScore : 0,
      speakingPassed: Boolean(p.speakingPassed),
      speakingRecordingMeta: p.speakingRecordingMeta,
      lastScore: typeof p.lastScore === "number" ? p.lastScore : undefined,
      masteredAt: typeof p.masteredAt === "string" ? p.masteredAt : undefined,
      dueAt: typeof p.dueAt === "string" ? p.dueAt : undefined,
      passedAt: typeof p.passedAt === "string" ? p.passedAt : undefined,
    };

    // Refresh due status from clock
    if (out[id]!.status === "mastered" && out[id]!.dueAt) {
      if (new Date(out[id]!.dueAt!).getTime() <= Date.now()) {
        out[id]!.status = "due";
      }
    }
  }
  return out;
}

function normalize(input: unknown): EduCurriculumProgress {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_EDU_PROGRESS, sectionProgress: {}, unitExams: {} };
  }
  const p = input as Partial<EduCurriculumProgress>;
  const schemaVersion = typeof p.schemaVersion === "number" ? p.schemaVersion : 1;
  const sectionProgress = normalizeSectionProgress(p.sectionProgress);

  // Legacy completed lessons without unit exam are cleared on schema upgrade
  let completed = Array.isArray(p.completedLessonIds)
    ? p.completedLessonIds.filter((id): id is EduLessonId =>
        typeof id === "string" &&
        ["01", "02", "03", "04", "05", "06", "07"].includes(id),
      )
    : [];

  const unitExams: Partial<Record<EduLessonId, EduUnitExamResult>> = {};
  if (p.unitExams && typeof p.unitExams === "object") {
    for (const [k, v] of Object.entries(p.unitExams)) {
      if (v && typeof v === "object" && typeof (v as EduUnitExamResult).passedAt === "string") {
        unitExams[k as EduLessonId] = v as EduUnitExamResult;
      }
    }
  }

  if (schemaVersion < SCHEMA) {
    // Strip lesson completes that lack a unit exam under new rules
    completed = completed.filter((id) => Boolean(unitExams[id]));
  }

  return {
    completedLessonIds: completed,
    currentLessonId:
      typeof p.currentLessonId === "string"
        ? (p.currentLessonId as EduLessonId)
        : "01",
    placement:
      p.placement && typeof p.placement === "object"
        ? (p.placement as PlacementResult)
        : undefined,
    sectionProgress,
    currentSectionId:
      typeof p.currentSectionId === "string" ? p.currentSectionId : undefined,
    unitExams,
    schemaVersion: SCHEMA,
    standardsBannerSeen: Boolean(p.standardsBannerSeen),
  };
}

let cached: EduCurriculumProgress | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cached = null;
  });
}

export function loadEduProgress(): EduCurriculumProgress {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh = { ...DEFAULT_EDU_PROGRESS, sectionProgress: {}, unitExams: {} };
      cached = fresh;
      return fresh;
    }
    const p = normalize(JSON.parse(raw));
    // Persist migration once
    if (p.schemaVersion === SCHEMA) {
      const prev = JSON.parse(raw) as Partial<EduCurriculumProgress>;
      if (prev.schemaVersion !== SCHEMA) {
        saveEduProgress(p);
      }
    }
    cached = p;
    return p;
  } catch {
    return { ...DEFAULT_EDU_PROGRESS, sectionProgress: {}, unitExams: {} };
  }
}

export function saveEduProgress(progress: EduCurriculumProgress): void {
  const next = { ...progress, schemaVersion: SCHEMA };
  localStorage.setItem(KEY, JSON.stringify(next));
  cached = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("joylingo:edu-progress"));
  }
}

export function markStandardsBannerSeen(): void {
  const cur = loadEduProgress();
  saveEduProgress({ ...cur, standardsBannerSeen: true });
}

export function savePlacementResult(result: PlacementResult): EduCurriculumProgress {
  const cur = loadEduProgress();
  const next: EduCurriculumProgress = {
    ...cur,
    currentLessonId: result.recommendedLessonId,
    placement: result,
  };
  saveEduProgress(next);
  return next;
}

export function setCurrentLesson(id: EduLessonId): EduCurriculumProgress {
  const cur = loadEduProgress();
  const next = { ...cur, currentLessonId: id };
  saveEduProgress(next);
  return next;
}

export function setCurrentSection(sectionId: string): EduCurriculumProgress {
  const cur = loadEduProgress();
  const next = { ...cur, currentSectionId: sectionId };
  saveEduProgress(next);
  return next;
}

/** Record a graded stage (listening / checkpoint / production). */
export function recordStageScore(
  sectionId: string,
  stage: PracticeStage,
  score: number,
  passed: boolean,
): EduCurriculumProgress {
  const cur = loadEduProgress();
  const prev = cur.sectionProgress[sectionId] ?? emptySection();
  const stagesCompleted = new Set(prev.stagesCompleted);
  if (passed) stagesCompleted.add(stage);

  const nextSec: EduSectionProgress = {
    ...prev,
    status: "in_progress",
    attempts: prev.attempts + (stage === "checkpoint" ? 1 : 0),
    stagesCompleted: [...stagesCompleted],
    bestScore: Math.max(prev.bestScore, stage === "checkpoint" ? score : prev.bestScore),
    bestListeningScore:
      stage === "listening"
        ? Math.max(prev.bestListeningScore, score)
        : prev.bestListeningScore,
    bestCheckpointScore:
      stage === "checkpoint"
        ? Math.max(prev.bestCheckpointScore, score)
        : prev.bestCheckpointScore,
    bestProductionScore:
      stage === "production"
        ? Math.max(prev.bestProductionScore, score)
        : prev.bestProductionScore,
    lastScore: score,
  };

  return finalizeSectionIfReady(cur, sectionId, nextSec);
}

export function recordSpeakingPass(
  sectionId: string,
  durationSec: number,
): EduCurriculumProgress {
  const cur = loadEduProgress();
  const prev = cur.sectionProgress[sectionId] ?? emptySection();
  const stagesCompleted = new Set(prev.stagesCompleted);
  stagesCompleted.add("speaking");
  const nextSec: EduSectionProgress = {
    ...prev,
    status: "in_progress",
    stagesCompleted: [...stagesCompleted],
    speakingPassed: true,
    speakingRecordingMeta: { at: new Date().toISOString(), durationSec },
  };
  return finalizeSectionIfReady(cur, sectionId, nextSec);
}

function finalizeSectionIfReady(
  cur: EduCurriculumProgress,
  sectionId: string,
  nextSec: EduSectionProgress,
): EduCurriculumProgress {
  if (sectionHasFullMasteryStages(nextSec) && nextSec.speakingPassed) {
    const interval = nextMasteryIntervalDays(5);
    const due = new Date(Date.now() + interval * 86400000).toISOString();
    nextSec = {
      ...nextSec,
      status: "mastered",
      masteredAt: new Date().toISOString(),
      dueAt: due,
      passedAt: new Date().toISOString(),
    };
  }

  const next: EduCurriculumProgress = {
    ...cur,
    currentSectionId: sectionId,
    sectionProgress: { ...cur.sectionProgress, [sectionId]: nextSec },
  };
  saveEduProgress(next);
  return next;
}

/** @deprecated Prefer recordStageScore — maps old single-pass to checkpoint only. */
export function recordSectionPractice(
  sectionId: string,
  opts: { score: number; passed: boolean },
): EduCurriculumProgress {
  return recordStageScore(sectionId, "checkpoint", opts.score, opts.passed);
}

export function markSectionPassed(
  sectionId: string,
  score: number,
): EduCurriculumProgress {
  // Old API: only checkpoint — does not grant full mastery alone
  return recordStageScore(sectionId, "checkpoint", score, true);
}

export function markLessonComplete(id: EduLessonId): EduCurriculumProgress {
  const cur = loadEduProgress();
  // Only allow if unit exam exists
  if (!cur.unitExams?.[id]) {
    return cur;
  }
  const completed = cur.completedLessonIds.includes(id)
    ? cur.completedLessonIds
    : [...cur.completedLessonIds, id];
  const order = ["01", "02", "03", "04", "05", "06", "07"] as EduLessonId[];
  const idx = order.indexOf(id);
  const nextLesson = order[idx + 1] ?? id;
  const next: EduCurriculumProgress = {
    ...cur,
    completedLessonIds: completed,
    currentLessonId: cur.currentLessonId === id ? nextLesson : cur.currentLessonId,
  };
  saveEduProgress(next);
  return next;
}

export function saveUnitExamResult(result: EduUnitExamResult): EduCurriculumProgress {
  const cur = loadEduProgress();
  const interval = 14;
  const withDue: EduUnitExamResult = {
    ...result,
    dueAt:
      result.dueAt ??
      new Date(Date.now() + interval * 86400000).toISOString(),
  };
  let next: EduCurriculumProgress = {
    ...cur,
    unitExams: { ...cur.unitExams, [result.lessonId]: withDue },
  };
  saveEduProgress(next);
  if (result.overall >= 0.85) {
    next = markLessonComplete(result.lessonId);
  }
  return next;
}

export function maybeCompleteLessonFromSections(
  lessonId: EduLessonId,
  sections: EduSection[],
): { progress: EduCurriculumProgress; lessonJustCompleted: boolean } {
  // Under school rules, section mastery alone does not complete the mega-lesson
  const cur = loadEduProgress();
  if (cur.unitExams?.[lessonId] && cur.completedLessonIds.includes(lessonId)) {
    return { progress: cur, lessonJustCompleted: false };
  }
  void lessonId;
  void sections;
  return { progress: cur, lessonJustCompleted: false };
}

export function lessonSectionStats(
  sections: EduSection[],
  progress?: EduCurriculumProgress,
): { passed: number; total: number; pct: number } {
  const p = progress ?? loadEduProgress();
  return countPassedSections(sections, p.sectionProgress);
}

export function sectionsReadyForUnitExam(
  sections: EduSection[],
  progress?: EduCurriculumProgress,
): boolean {
  const p = progress ?? loadEduProgress();
  return allSectionsPassed(sections, p.sectionProgress);
}

export function refreshDueStatuses(): EduCurriculumProgress {
  const cur = loadEduProgress();
  let dirty = false;
  const sectionProgress = { ...cur.sectionProgress };
  for (const [id, sec] of Object.entries(sectionProgress)) {
    if (isSectionDue(sectionProgress, id)) {
      if (sec.status !== "due") {
        sectionProgress[id] = { ...sec, status: "due" };
        dirty = true;
      }
    }
  }
  if (!dirty) return cur;
  const next = { ...cur, sectionProgress };
  saveEduProgress(next);
  return next;
}

export {
  isSectionMastered,
  isSectionDue,
  SECTION_MASTERY_STAGES,
  allSectionsPassed,
};
