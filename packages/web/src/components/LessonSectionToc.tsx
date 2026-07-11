/** Sticky TOC + section progress for an EDU mega-lesson. */
import type { EduSection, EduSectionProgress } from "@joylingo/shared";
import {
  countPassedSections,
  getSectionProgress,
  isSectionMastered,
} from "@joylingo/shared";

interface Props {
  sections: EduSection[];
  sectionProgress: Record<string, EduSectionProgress>;
  practiceReady: Record<string, boolean>;
  activeSectionId?: string;
  onJump: (sectionId: string) => void;
  onPractice: (sectionId: string) => void;
}

export function LessonSectionToc({
  sections,
  sectionProgress,
  practiceReady,
  activeSectionId,
  onJump,
  onPractice,
}: Props) {
  const { passed, total, pct } = countPassedSections(sections, sectionProgress);

  return (
    <aside className="ip-lesson-toc" aria-label="Lesson sections">
      <div className="ip-lesson-toc-progress">
        <div className="ip-lesson-toc-progress-head">
          <span className="ip-section-label">Short lessons</span>
          <span className="ip-lesson-toc-count">
            {passed}/{total} mastered · {pct}%
          </span>
        </div>
        <div
          className="ip-lesson-toc-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="ip-lesson-toc-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="ip-lesson-toc-list">
        {sections.map((s) => {
          const prog = getSectionProgress(sectionProgress, s.id);
          const ready = practiceReady[s.id] ?? false;
          const mastered = isSectionMastered(sectionProgress, s.id);
          const due = prog.status === "due";
          return (
            <li
              key={s.id}
              className={
                "ip-lesson-toc-item" +
                (mastered ? " passed" : "") +
                (due ? " due" : "") +
                (activeSectionId === s.id ? " active" : "")
              }
            >
              <button
                type="button"
                className="ip-lesson-toc-link"
                onClick={() => onJump(s.id)}
              >
                <span className="ip-lesson-toc-mark" aria-hidden>
                  {mastered ? "✓" : due ? "!" : prog.status === "in_progress" ? "●" : "○"}
                </span>
                <span className="ip-lesson-toc-title">{s.title}</span>
              </button>
              {mastered && !due ? (
                <span className="chip ip-lesson-toc-chip">Mastered</span>
              ) : due ? (
                <button
                  type="button"
                  className="btn-secondary ip-lesson-toc-practice"
                  onClick={() => onPractice(s.id)}
                >
                  Due
                </button>
              ) : ready ? (
                <button
                  type="button"
                  className="btn-secondary ip-lesson-toc-practice"
                  onClick={() => onPractice(s.id)}
                >
                  Practice
                </button>
              ) : (
                <span className="chip ip-lesson-toc-chip muted">Soon</span>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
