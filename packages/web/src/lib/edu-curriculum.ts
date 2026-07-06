/** EDU_JAP curriculum progress (device-local). */
import {
  DEFAULT_EDU_PROGRESS,
  type EduCurriculumProgress,
  type EduLessonId,
  type PlacementResult,
} from "@joylingo/shared";

const KEY = "joylingo:edu-curriculum";

function normalize(input: unknown): EduCurriculumProgress {
  if (!input || typeof input !== "object") return { ...DEFAULT_EDU_PROGRESS };
  const p = input as Partial<EduCurriculumProgress>;
  const completed = Array.isArray(p.completedLessonIds)
    ? p.completedLessonIds.filter((id): id is EduLessonId =>
        typeof id === "string" && ["01", "02", "03", "04", "05", "06", "07"].includes(id),
      )
    : [];
  return {
    completedLessonIds: completed,
    currentLessonId:
      typeof p.currentLessonId === "string" ? (p.currentLessonId as EduLessonId) : "01",
    placement: p.placement && typeof p.placement === "object"
      ? (p.placement as PlacementResult)
      : undefined,
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
    if (!raw) return { ...DEFAULT_EDU_PROGRESS };
    const p = normalize(JSON.parse(raw));
    cached = p;
    return p;
  } catch {
    return { ...DEFAULT_EDU_PROGRESS };
  }
}

export function saveEduProgress(progress: EduCurriculumProgress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
  cached = progress;
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

export function markLessonComplete(id: EduLessonId): EduCurriculumProgress {
  const cur = loadEduProgress();
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
