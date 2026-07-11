/** EDU_JAP lesson list (Genki + Tobira curriculum). */
import { useEffect, useState } from "react";
import {
  EDU_LESSON_BY_ID,
  EDU_LESSONS,
  countPassedSections,
  parseSectionsFromMarkdown,
  type EduLesson,
  type EduLessonId,
  type PlacementResult,
} from "@joylingo/shared";
import { loadEduProgress } from "../lib/edu-curriculum";
import { navigate } from "../App";

interface Props {
  completedIds: EduLessonId[];
  currentId: EduLessonId | null;
  placement?: PlacementResult;
}

export function EduLessonList({ completedIds, currentId, placement }: Props) {
  const recommended = placement?.recommendedLessonId;
  const [sectionCounts, setSectionCounts] = useState<
    Record<string, { passed: number; total: number }>
  >({});

  useEffect(() => {
    let cancelled = false;
    const progress = loadEduProgress();
    void (async () => {
      const next: Record<string, { passed: number; total: number }> = {};
      await Promise.all(
        EDU_LESSONS.map(async (lesson) => {
          try {
            const res = await fetch(`/curriculum/${lesson.file}`);
            if (!res.ok) return;
            const md = await res.text();
            const sections = parseSectionsFromMarkdown(md, lesson.id);
            next[lesson.id] = countPassedSections(sections, progress.sectionProgress);
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setSectionCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [completedIds, currentId]);

  return (
    <section className="ip-edu-lessons">
      <div className="ip-edu-placement-cta">
        <div>
          <div className="ip-section-label">Placement test</div>
          <h3 className="ip-edu-placement-title">Find your starting point</h3>
          <p className="ip-paste-hint">
            62 questions across kana, N5–N2 grammar, keigo, and reading.
            Includes a &ldquo;Don&apos;t know&rdquo; option so guessing won&apos;t inflate your level.
          </p>
          {placement && (
            <p className="ip-edu-placement-last">
              Last score: <strong>{placement.totalScore}/{placement.maxScore}</strong>
              {" → "}
              <span lang="ja">{EDU_LESSON_BY_ID[placement.recommendedLessonId].titleJa}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate("/curriculum/placement")}
        >
          {placement ? "Retake placement test" : "Take placement test"}
        </button>
      </div>

      <div className="ip-section-label">Lessons · Genki I &amp; II + Tobira</div>
      <ol className="ip-edu-lesson-list">
        {EDU_LESSONS.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            done={completedIds.includes(lesson.id)}
            current={currentId === lesson.id}
            recommended={recommended === lesson.id}
            sectionCount={sectionCounts[lesson.id]}
          />
        ))}
      </ol>

      <div className="ip-edu-overview">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate("/curriculum/overview")}
        >
          View curriculum overview
        </button>
      </div>
    </section>
  );
}

function LessonRow({
  lesson,
  done,
  current,
  recommended,
  sectionCount,
}: {
  lesson: EduLesson;
  done: boolean;
  current: boolean;
  recommended: boolean;
  sectionCount?: { passed: number; total: number };
}) {
  const partial =
    sectionCount && sectionCount.total > 0
      ? `${sectionCount.passed}/${sectionCount.total}`
      : null;
  const pct =
    sectionCount && sectionCount.total > 0
      ? Math.round((sectionCount.passed / sectionCount.total) * 100)
      : 0;

  return (
    <li
      className={
        "ip-edu-lesson-row" +
        (done ? " done" : "") +
        (current ? " current" : "") +
        (recommended ? " recommended" : "")
      }
    >
      <span className="ip-edu-lesson-num">{lesson.id}</span>
      <div className="ip-edu-lesson-body">
        <div className="ip-edu-lesson-head">
          <span className="ip-edu-lesson-title" lang="ja">
            {lesson.titleJa}
          </span>
          {recommended && <span className="chip chip-amber">Start here</span>}
          {done && <span className="chip">Unit ready</span>}
          {current && !done && <span className="chip">In progress</span>}
          {!done && partial && (
            <span className="chip">{partial} mastered</span>
          )}
        </div>
        <div className="ip-edu-lesson-meta">
          {lesson.title} · {lesson.source} · {lesson.jlpt} · ~{lesson.hours}h
        </div>
        {lesson.prerequisite && (
          <div className="ip-edu-lesson-pre">Requires: {lesson.prerequisite}</div>
        )}
        {!done && sectionCount && sectionCount.total > 0 && (
          <div className="ip-edu-lesson-mini-bar" aria-hidden>
            <div style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn-secondary ip-edu-lesson-open"
        onClick={() => navigate(`/curriculum/lesson/${lesson.slug}`)}
      >
        Open
      </button>
    </li>
  );
}
