/** Curriculum progress store (device-local; survives refresh). */
import {
  DEFAULT_CURRICULUM_PROGRESS,
  type CurriculumProgress,
  type StepId,
} from "@joylingo/shared";

const KEY = "joylingo:curriculum-progress";

function normalize(input: unknown): CurriculumProgress {
  if (!input || typeof input !== "object") return { ...DEFAULT_CURRICULUM_PROGRESS };
  const p = input as Partial<CurriculumProgress>;
  const completed = Array.isArray(p.completedStepIds)
    ? p.completedStepIds.filter((s): s is StepId => typeof s === "string")
    : [];
  return {
    currentStepId: p.currentStepId ?? "kana",
    completedStepIds: completed,
    episodeIdForPath: typeof p.episodeIdForPath === "string" ? p.episodeIdForPath : undefined,
  };
}

let cached: CurriculumProgress | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cached = null;
  });
}

export function loadCurriculumProgress(): CurriculumProgress {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_CURRICULUM_PROGRESS };
    const p = normalize(JSON.parse(raw));
    cached = p;
    return p;
  } catch {
    return { ...DEFAULT_CURRICULUM_PROGRESS };
  }
}

export function saveCurriculumProgress(progress: CurriculumProgress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
  cached = progress;
}

export function markStepComplete(step: StepId, episodeId?: string): CurriculumProgress {
  const cur = loadCurriculumProgress();
  if (cur.completedStepIds.includes(step) && !episodeId) return cur;
  const completed = cur.completedStepIds.includes(step)
    ? cur.completedStepIds
    : [...cur.completedStepIds, step];
  const next: CurriculumProgress = {
    ...cur,
    completedStepIds: completed,
    currentStepId: cur.currentStepId,
    episodeIdForPath: episodeId ?? cur.episodeIdForPath,
  };
  saveCurriculumProgress(next);
  return next;
}

/** Bump the pointer to the latest completed step so the widget reflects progress. */
export function setCurrentStep(step: StepId): CurriculumProgress {
  const cur = loadCurriculumProgress();
  if (cur.currentStepId === step) return cur;
  const next: CurriculumProgress = { ...cur, currentStepId: step };
  saveCurriculumProgress(next);
  return next;
}