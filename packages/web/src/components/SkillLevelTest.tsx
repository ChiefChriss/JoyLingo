/** Interactive placement test from skill_level.md with "don't know" option. */
import { useMemo, useState } from "react";
import {
  EDU_LESSON_BY_ID,
  scorePlacement,
  SKILL_QUESTIONS,
  SKILL_SECTIONS,
  type PlacementResult,
  type SkillAnswer,
  type SkillSectionId,
} from "@joylingo/shared";
import { savePlacementResult } from "../lib/edu-curriculum";
import { navigate } from "../App";

interface Props {
  onComplete?: (result: PlacementResult) => void;
}

export function SkillLevelTest({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SkillAnswer>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);

  const question = SKILL_QUESTIONS[index]!;
  const total = SKILL_QUESTIONS.length;
  const answered = Object.keys(answers).length;

  const sectionLabel = SKILL_SECTIONS[question.section]?.label ?? question.section;
  const showPassage =
    question.passage &&
    (index === 0 || SKILL_QUESTIONS[index - 1]?.passage !== question.passage);

  const sectionProgress = useMemo(() => {
    const map = new Map<SkillSectionId, { done: number; total: number }>();
    for (const q of SKILL_QUESTIONS) {
      const e = map.get(q.section) ?? { done: 0, total: 0 };
      e.total += 1;
      if (answers[q.id] !== undefined) e.done += 1;
      map.set(q.section, e);
    }
    return map;
  }, [answers]);

  const pick = (choice: SkillAnswer) => {
    const next = { ...answers, [question.id]: choice };
    setAnswers(next);
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    const scored = scorePlacement(SKILL_QUESTIONS, next);
    const full: PlacementResult = { ...scored, completedAt: new Date().toISOString() };
    savePlacementResult(full);
    setResult(full);
    onComplete?.(full);
  };

  if (result) {
    const lesson = EDU_LESSON_BY_ID[result.recommendedLessonId];
    return (
      <section className="ip-curriculum ip-placement-result">
        <div className="ip-curriculum-head">
          <div className="ip-section-label">Placement complete</div>
          <h2 className="ip-curriculum-title">{result.levelLabel}</h2>
          <p className="ip-paste-hint">{result.levelDetail}</p>
        </div>

        <div className="ip-placement-score-card">
          <div className="ip-placement-score-main">
            <span className="ip-placement-score-num">{result.totalScore}</span>
            <span className="ip-placement-score-denom">/ {result.maxScore}</span>
          </div>
          <p className="ip-paste-hint">
            Only confirmed answers count. &ldquo;Don&apos;t know&rdquo; responses are not penalized
            and don&apos;t inflate your score from guessing.
          </p>
        </div>

        <div className="ip-placement-sections">
          {result.sectionScores.map((s) => (
            <div key={s.section} className="ip-placement-section-row">
              <div className="ip-placement-section-head">
                <span>Section {s.section}: {SKILL_SECTIONS[s.section]?.label}</span>
                <span>{s.correct}/{s.max}</span>
              </div>
              <div className="ip-curriculum-bar">
                <div
                  className="ip-curriculum-bar-fill"
                  style={{ width: `${(s.correct / Math.max(1, s.max)) * 100}%` }}
                />
              </div>
              {s.skipped > 0 && (
                <div className="ip-placement-skipped">{s.skipped} marked &ldquo;don&apos;t know&rdquo;</div>
              )}
            </div>
          ))}
        </div>

        <div className="ip-placement-recommend">
          <div className="ip-section-label">Recommended starting lesson</div>
          <div className="ip-placement-lesson-card">
            <span className="ip-placement-lesson-num">{result.recommendedLessonId}</span>
            <div>
              <div className="ip-placement-lesson-title" lang="ja">{lesson.titleJa}</div>
              <div className="ip-placement-lesson-en">{lesson.title}</div>
              <div className="ip-paste-hint">{lesson.source} · {lesson.jlpt}</div>
            </div>
          </div>
        </div>

        <div className="ip-onboarding-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(`/curriculum/lesson/${lesson.slug}`)}
          >
            Start {lesson.title}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/curriculum")}>
            Back to curriculum
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ip-curriculum ip-placement-test">
      <div className="ip-curriculum-head">
        <div className="ip-section-label">Section {question.section} · {sectionLabel}</div>
        <h2 className="ip-curriculum-title">Skill level assessment</h2>
        <p className="ip-paste-hint">
          Question {index + 1} of {total} · {answered} answered.
          Use &ldquo;Don&apos;t know&rdquo; instead of guessing — it won&apos;t count against you
          or inflate your score.
        </p>
      </div>

      <div className="ip-placement-progress">
        <div className="ip-curriculum-bar">
          <div
            className="ip-curriculum-bar-fill"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <div className="ip-curriculum-count">{index + 1} / {total}</div>
      </div>

      <div className="ip-placement-section-pills">
        {(["A", "B", "C", "D", "E", "F", "G"] as SkillSectionId[]).map((s) => {
          const p = sectionProgress.get(s);
          if (!p) return null;
          const active = question.section === s;
          return (
            <span key={s} className={"chip" + (active ? " chip-amber" : "")}>
              {s}: {p.done}/{p.total}
            </span>
          );
        })}
      </div>

      {showPassage && (
        <blockquote className="ip-placement-passage" lang="ja">{question.passage}</blockquote>
      )}

      <div className="ip-placement-question">
        <p className="ip-placement-prompt" lang="ja">{question.prompt}</p>
        <div className="ip-placement-options">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={
                "ip-placement-option" +
                (answers[question.id] === opt.id ? " sel" : "")
              }
              onClick={() => pick(opt.id)}
            >
              <span className="ip-placement-option-id">{opt.id})</span>
              <span lang="ja">{opt.text}</span>
            </button>
          ))}
          <button
            type="button"
            className={
              "ip-placement-option ip-placement-unknown" +
              (answers[question.id] === "unknown" ? " sel" : "")
            }
            onClick={() => pick("unknown")}
          >
            <span className="ip-placement-option-id">—</span>
            <span>Don&apos;t know</span>
          </button>
        </div>
      </div>

      <div className="ip-placement-nav">
        <button
          type="button"
          className="btn-secondary"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          Previous
        </button>
        {answers[question.id] !== undefined && index < total - 1 && (
          <button type="button" className="btn-primary" onClick={() => setIndex(index + 1)}>
            Next
          </button>
        )}
      </div>
    </section>
  );
}
