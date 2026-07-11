/** Renders an EDU_JAP markdown lesson with section progress + practice gates. */
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EDU_LESSON_BY_SLUG,
  EDU_LESSONS,
  allSectionsPassed,
  countPassedSections,
  fusionVocabLessonId,
  isSectionMastered,
  lessonSupportsFusion,
  type CurriculumWord,
  type EduSection,
  type EduSectionId,
  type FusionCard,
  type PracticeSet,
  type PracticeStage,
} from "@joylingo/shared";
import { dueFusionCards } from "@joylingo/player-core";
import {
  loadEduProgress,
  markStandardsBannerSeen,
  recordSpeakingPass,
  recordStageScore,
  refreshDueStatuses,
  saveUnitExamResult,
  sectionsReadyForUnitExam,
  setCurrentLesson,
  setCurrentSection,
} from "../lib/edu-curriculum";
import { fetchCurriculumWords, fetchDueFusionCards, postFusionReview } from "../lib/api";
import { loadFusionDeck, mergeFusionCards, saveFusionDeck } from "../lib/fusion-deck";
import { getDeviceId } from "../lib/vocabulary";
import {
  parseLessonContent,
  resolveAllPracticeSets,
} from "../lib/section-practice";
import { navigate } from "../App";
import { SiteNav } from "./SiteNav";
import { FusionClipsSection } from "./FusionClipsSection";
import { FusionReviewModal } from "./FusionReviewModal";
import { TeacherPanel } from "./TeacherPanel";
import { teacherUiEnabled } from "../lib/teacher-memory";
import { LessonSectionToc } from "./LessonSectionToc";
import { SectionPracticeModal } from "./SectionPracticeModal";
import { UnitExamModal } from "./UnitExamModal";

interface Props {
  slug: string;
}

marked.setOptions({ gfm: true, breaks: true });

/** Inject id anchors on each H2 to match parsed sections (order-based). */
function htmlWithSectionAnchors(html: string, sections: EduSection[]): string {
  let i = 0;
  return html.replace(/<h2(\s[^>]*)?>/gi, (full) => {
    const section = sections[i++];
    if (!section) return full;
    if (/\sid=/i.test(full)) {
      return full.replace(/\sid="[^"]*"/i, ` id="${section.id}"`);
    }
    return full.replace(/<h2/i, `<h2 id="${section.id}" data-section-id="${section.id}"`);
  });
}

function stripPracticeFencesFromMd(md: string): string {
  return md.replace(/```joylingo-practice\s*\n[\s\S]*?```/g, "");
}

export function EduLessonView({ slug }: Props) {
  const lesson = EDU_LESSON_BY_SLUG[slug];
  const vocabLessonId = lesson ? fusionVocabLessonId(lesson.id) : null;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [fusionDeck, setFusionDeck] = useState(() => loadFusionDeck());
  const [lessonGlosses, setLessonGlosses] = useState<string[]>([]);
  const [vocabWords, setVocabWords] = useState<CurriculumWord[]>([]);
  const [sections, setSections] = useState<EduSection[]>([]);
  const [practiceBySection, setPracticeBySection] = useState<
    Map<EduSectionId, PracticeSet>
  >(() => new Map());
  const [progressTick, setProgressTick] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>();
  const [practicingId, setPracticingId] = useState<string | null>(null);
  const [unitExamOpen, setUnitExamOpen] = useState(false);
  const [celebration, setCelebration] = useState<{
    kind: "section" | "lesson";
    title: string;
    score?: number;
  } | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);

  const eduProgress = useMemo(() => {
    refreshDueStatuses();
    return loadEduProgress();
  }, [progressTick]);

  const dueCards = useMemo(
    () => dueFusionCards(Object.values(fusionDeck)),
    [fusionDeck],
  );

  const lessonDueCards = useMemo(() => {
    if (!vocabLessonId) return [];
    const prefix = `${vocabLessonId}-`;
    return dueCards.filter((c) => c.curriculumWordId.startsWith(prefix));
  }, [dueCards, vocabLessonId]);

  const sectionStats = useMemo(
    () => countPassedSections(sections, eduProgress.sectionProgress),
    [sections, eduProgress.sectionProgress],
  );

  const allPassed = useMemo(
    () => allSectionsPassed(sections, eduProgress.sectionProgress),
    [sections, eduProgress.sectionProgress],
  );

  const unitReady = Boolean(eduProgress.unitExams?.[lesson?.id ?? "01"]);

  const practiceReady = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const s of sections) {
      const set = practiceBySection.get(s.id);
      m[s.id] = Boolean(set && set.items.length > 0);
    }
    return m;
  }, [sections, practiceBySection]);

  useEffect(() => {
    void fetchDueFusionCards(getDeviceId()).then((remote) => {
      if (remote.length > 0) {
        setFusionDeck((prev) => mergeFusionCards(prev, remote));
      }
    });
  }, []);

  useEffect(() => {
    if (!vocabLessonId) return;
    void fetchCurriculumWords(vocabLessonId).then((words) => {
      setLessonGlosses(words.map((w) => w.gloss));
      setVocabWords(words);
    });
  }, [vocabLessonId]);

  useEffect(() => {
    if (!lesson) return;
    setCurrentLesson(lesson.id);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/curriculum/${lesson.file}`);
        if (!res.ok) throw new Error(`Failed to load lesson (${res.status})`);
        const md = await res.text();
        if (cancelled) return;
        const { sections: secs, authored } = parseLessonContent(md, lesson.id);
        const practices = resolveAllPracticeSets(
          lesson.id,
          secs,
          authored,
          vocabWords,
        );
        const displayMd = stripPracticeFencesFromMd(md);
        const rawHtml = marked.parse(displayMd) as string;
        setSections(secs);
        setPracticeBySection(practices);
        setHtml(htmlWithSectionAnchors(rawHtml, secs));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson, vocabWords]);

  // Re-resolve practices when vocab arrives for 03/05
  useEffect(() => {
    if (!lesson || sections.length === 0) return;
    if (lesson.id !== "03" && lesson.id !== "05") return;
    if (vocabWords.length === 0) return;
    // re-parse from last html is hard; re-fetch is already tied to vocabWords in main effect
  }, [lesson, sections.length, vocabWords]);

  // Intersection observer for active section
  useEffect(() => {
    if (!html || sections.length === 0) return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActiveSectionId(id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] },
    );
    for (const el of els) obs.observe(el);
    return () => obs.disconnect();
  }, [html, sections]);

  const handleFusionGrade = useCallback((card: FusionCard, good: boolean) => {
    setFusionDeck((prev) => {
      const next = { ...prev, [card.id]: card };
      saveFusionDeck(next);
      return next;
    });
    void postFusionReview(card.id, good, getDeviceId());
  }, []);

  const jumpToSection = useCallback((sectionId: string) => {
    setCurrentSection(sectionId);
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSectionId(sectionId);
  }, []);

  const openPractice = useCallback((sectionId: string) => {
    setPracticingId(sectionId);
    setCurrentSection(sectionId);
  }, []);

  const bumpKanaFromSet = useCallback(
    (sectionId: string) => {
      const pset = practiceBySection.get(sectionId);
      if (pset?.kind !== "kana") return;
      void import("../lib/kana").then(({ loadKanaProgress, saveKanaProgress, allKana }) => {
        for (const script of ["hiragana", "katakana"] as const) {
          const chars = new Set(allKana(script).map((k) => k.char));
          const prog = loadKanaProgress(script);
          let dirty = false;
          for (const item of pset.items) {
            if (chars.has(item.answer)) {
              const cur = prog[item.answer] ?? { correct: 0, wrong: 0 };
              prog[item.answer] = { ...cur, correct: cur.correct + 1 };
              dirty = true;
            }
          }
          if (dirty) saveKanaProgress(script, prog);
        }
      });
    },
    [practiceBySection],
  );

  const onStagePassed = useCallback(
    (sectionId: string, stage: PracticeStage, score: number) => {
      recordStageScore(sectionId, stage, score, true);
      if (stage === "production" || stage === "checkpoint") bumpKanaFromSet(sectionId);
      setProgressTick((t) => t + 1);
    },
    [bumpKanaFromSet],
  );

  const onSpeakingPassed = useCallback((sectionId: string, durationSec: number) => {
    const prog = recordSpeakingPass(sectionId, durationSec);
    setProgressTick((t) => t + 1);
    const section = sections.find((s) => s.id === sectionId);
    if (isSectionMastered(prog.sectionProgress, sectionId)) {
      setPracticingId(null);
      setCelebration({
        kind: "section",
        title: section?.title ?? "Section",
        score: prog.sectionProgress[sectionId]?.bestProductionScore,
      });
    }
  }, [sections]);

  const onSectionFullyMastered = useCallback(
    (sectionId: string) => {
      const prog = loadEduProgress();
      if (isSectionMastered(prog.sectionProgress, sectionId)) {
        setPracticingId(null);
        const section = sections.find((s) => s.id === sectionId);
        setCelebration({
          kind: "section",
          title: section?.title ?? "Section",
        });
        setProgressTick((t) => t + 1);
      }
    },
    [sections],
  );

  if (!lesson) {
    return (
      <div className="ip-root">
        <div className="ip-error">Unknown lesson.</div>
        <button className="btn-secondary" onClick={() => navigate("/curriculum")}>
          Back
        </button>
      </div>
    );
  }

  const idx = EDU_LESSONS.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? EDU_LESSONS[idx - 1] : null;
  const next = idx < EDU_LESSONS.length - 1 ? EDU_LESSONS[idx + 1] : null;
  const showFusion = lessonSupportsFusion(lesson.id);
  const practicingSection = practicingId
    ? sections.find((s) => s.id === practicingId)
    : null;
  const practicingSet = practicingId ? practiceBySection.get(practicingId) : null;

  return (
    <div className="ip-root ip-lesson-page">
      <SiteNav active="curriculum" />
      <header className="ip-lesson-header">
        <button type="button" className="ip-back" onClick={() => navigate("/curriculum")}>
          ← Curriculum
        </button>
        <div className="ip-lesson-header-meta">
          <span className="chip chip-amber">Lesson {lesson.id}</span>
          <span className="chip">{lesson.jlpt}</span>
          <span className="chip">{lesson.hours}h est.</span>
          {sections.length > 0 && (
            <span className="chip">
              {sectionStats.passed}/{sectionStats.total} sections
            </span>
          )}
        </div>
        <h1 className="ip-lesson-title" lang="ja">
          {lesson.titleJa}
        </h1>
        <p className="ip-lesson-subtitle">
          {lesson.title} · {lesson.source}
        </p>
        {lesson.prerequisite && (
          <p className="ip-paste-hint">Prerequisite: {lesson.prerequisite}</p>
        )}
        {sections.length > 0 && (
          <div className="ip-lesson-header-progress">
            <div
              className="ip-lesson-toc-bar"
              role="progressbar"
              aria-valuenow={sectionStats.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="ip-lesson-toc-bar-fill"
                style={{ width: `${sectionStats.pct}%` }}
              />
            </div>
            <span className="ip-paste-hint">
              Mastered {sectionStats.pct}% of short lessons · unit exam required for lesson complete
            </span>
          </div>
        )}
        {!eduProgress.standardsBannerSeen && (
          <div className="ip-standards-banner">
            <strong>School-grade practice:</strong> each short lesson needs listening, checkpoint
            (≥85%), production (≥85%), and speaking. Mega-lesson complete requires a unit exam.
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: 8 }}
              onClick={() => {
                markStandardsBannerSeen();
                setProgressTick((t) => t + 1);
              }}
            >
              Got it
            </button>
          </div>
        )}
        {lessonDueCards.length > 0 && (
          <button type="button" className="btn-primary" onClick={() => setReviewing(true)}>
            Review {lessonDueCards.length} fusion clip
            {lessonDueCards.length === 1 ? "" : "s"}
          </button>
        )}
      </header>

      {error && <div className="ip-error">{error}</div>}
      {!html && !error && <div className="ip-loading">Loading lesson…</div>}

      {html && (
        <div
          className={
            "ip-lesson-layout" +
            (teacherUiEnabled() ? " with-teacher" : "") +
            (sections.length === 0 ? " no-toc" : "")
          }
        >
          {sections.length > 0 && (
            <LessonSectionToc
              sections={sections}
              sectionProgress={eduProgress.sectionProgress}
              practiceReady={practiceReady}
              activeSectionId={activeSectionId}
              onJump={jumpToSection}
              onPractice={openPractice}
            />
          )}
          <div className="ip-lesson-main">
            <article
              ref={bodyRef}
              className="ip-lesson-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {sections.length > 0 && (
              <div className="ip-lesson-gates">
                {sections.map((s) => {
                  const prog = eduProgress.sectionProgress[s.id];
                  const ready = practiceReady[s.id];
                  const mastered = isSectionMastered(eduProgress.sectionProgress, s.id);
                  const due = prog?.status === "due";
                  const stages = prog?.stagesCompleted ?? [];
                  return (
                    <div
                      key={s.id}
                      className={
                        "ip-lesson-gate-card" +
                        (mastered ? " passed" : "") +
                        (due ? " due" : "")
                      }
                      data-gate-for={s.id}
                    >
                      <div className="ip-lesson-gate-text">
                        <strong>{s.title}</strong>
                        <span className="ip-paste-hint">
                          {mastered
                            ? `Mastered · L/C/P/S complete`
                            : due
                              ? "Due for retest — listening + production + speaking"
                              : ready
                                ? `School stages: listen → checkpoint → production → speak (85%)${
                                    stages.length ? ` · done: ${stages.join(", ")}` : ""
                                  }`
                                : "Practice content coming soon"}
                        </span>
                      </div>
                      {mastered && !due ? (
                        <span className="chip">✓ Mastered</span>
                      ) : ready ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => openPractice(s.id)}
                        >
                          {due ? "Retest" : stages.length ? "Continue" : "Practice"}
                        </button>
                      ) : (
                        <span className="chip">Soon</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {teacherUiEnabled() && (
            <TeacherPanel lessonId={lesson.id} lessonTitle={lesson.title} />
          )}
        </div>
      )}

      {showFusion && vocabLessonId && (
        <FusionClipsSection lessonId={vocabLessonId} onDeckUpdate={setFusionDeck} />
      )}

      <footer className="ip-lesson-footer">
        <button
          type="button"
          className="btn-primary"
          disabled={
            sections.length > 0 &&
            (!sectionsReadyForUnitExam(sections, eduProgress) || unitReady)
          }
          onClick={() => {
            if (unitReady) {
              if (next) navigate(`/curriculum/lesson/${next.slug}`);
              else navigate("/curriculum");
              return;
            }
            if (sectionsReadyForUnitExam(sections, eduProgress)) {
              setUnitExamOpen(true);
            }
          }}
          title={
            unitReady
              ? "Unit exam already passed"
              : sectionsReadyForUnitExam(sections, eduProgress)
                ? "Open unit exam"
                : `Master ${sectionStats.total - sectionStats.passed} more short lesson(s) first`
          }
        >
          {unitReady
            ? next
              ? "Unit ready · continue →"
              : "Unit ready"
            : sectionsReadyForUnitExam(sections, eduProgress)
              ? "Take unit exam"
              : `Master ${sectionStats.total - sectionStats.passed} more short lesson${
                  sectionStats.total - sectionStats.passed === 1 ? "" : "s"
                }`}
        </button>
        <div className="ip-lesson-footer-nav">
          {prev && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(`/curriculum/lesson/${prev.slug}`)}
            >
              ← {prev.title}
            </button>
          )}
          {next && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(`/curriculum/lesson/${next.slug}`)}
            >
              {next.title} →
            </button>
          )}
        </div>
      </footer>

      {reviewing && (
        <FusionReviewModal
          cards={lessonDueCards}
          lessonGlosses={lessonGlosses}
          onGrade={handleFusionGrade}
          onClose={() => setReviewing(false)}
        />
      )}

      {practicingSection && practicingSet && practicingSet.items.length > 0 && (
        <SectionPracticeModal
          set={practicingSet}
          sectionTitle={practicingSection.title}
          onStagePassed={({ stage, score }) =>
            onStagePassed(practicingSection.id, stage, score)
          }
          onSpeakingPassed={(dur) => onSpeakingPassed(practicingSection.id, dur)}
          onFullyMastered={() => onSectionFullyMastered(practicingSection.id)}
          onClose={() => setPracticingId(null)}
        />
      )}

      {unitExamOpen && (
        <UnitExamModal
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          sections={sections}
          practiceBySection={practiceBySection}
          onPassed={(result) => {
            saveUnitExamResult({
              lessonId: lesson.id,
              overall: result.overall,
              blockScores: result.blockScores,
              passedAt: new Date().toISOString(),
            });
            setProgressTick((t) => t + 1);
            setCelebration({ kind: "lesson", title: lesson.title, score: result.overall });
          }}
          onClose={() => setUnitExamOpen(false)}
        />
      )}

      {celebration && (
        <div className="ip-modal-backdrop" role="presentation" onClick={() => setCelebration(null)}>
          <div
            className="ip-modal ip-lesson-celebration"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ip-section-practice-result-emoji" aria-hidden>
              {celebration.kind === "lesson" ? "★" : "✓"}
            </div>
            <h2>
              {celebration.kind === "lesson"
                ? "Whole lesson complete!"
                : "Short lesson complete!"}
            </h2>
            <p>
              <strong>{celebration.title}</strong>
              {celebration.score != null && (
                <> · first-try {Math.round(celebration.score * 100)}%</>
              )}
            </p>
            {celebration.kind === "section" && (
              <p className="ip-paste-hint">
                Keep going — {sectionStats.passed}/{sectionStats.total} sections done.
              </p>
            )}
            <div className="ip-lesson-celebration-actions">
              {celebration.kind === "section" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setCelebration(null);
                    const latest = loadEduProgress();
                    const nextSec = sections.find(
                      (s) => latest.sectionProgress[s.id]?.status !== "passed",
                    );
                    if (nextSec) {
                      jumpToSection(nextSec.id);
                      if (practiceReady[nextSec.id]) openPractice(nextSec.id);
                    }
                  }}
                >
                  Next section
                </button>
              )}
              {celebration.kind === "lesson" && next && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate(`/curriculum/lesson/${next.slug}`)}
                >
                  Continue to {next.title} →
                </button>
              )}
              {celebration.kind === "lesson" && !next && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate("/curriculum")}
                >
                  Back to curriculum
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCelebration(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function lessonSlugFromPath(path: string): string | null {
  const m = /^\/curriculum\/lesson\/([^/]+)$/.exec(path);
  return m ? decodeURIComponent(m[1]!) : null;
}
