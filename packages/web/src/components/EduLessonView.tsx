/** Renders an EDU_JAP markdown lesson from /public/curriculum. */
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EDU_LESSON_BY_SLUG,
  EDU_LESSONS,
  type FusionCard,
} from "@joylingo/shared";
import { dueFusionCards } from "@joylingo/player-core";
import { markLessonComplete, setCurrentLesson } from "../lib/edu-curriculum";
import { fetchCurriculumWords, fetchDueFusionCards, postFusionReview } from "../lib/api";
import { loadFusionDeck, mergeFusionCards, saveFusionDeck } from "../lib/fusion-deck";
import { getDeviceId } from "../lib/vocabulary";
import { navigate } from "../App";
import { SiteNav } from "./SiteNav";
import { FusionClipsSection } from "./FusionClipsSection";
import { FusionReviewModal } from "./FusionReviewModal";

interface Props {
  slug: string;
}

const VOCAB_LESSONS = new Set(["03", "05"]);

marked.setOptions({ gfm: true, breaks: true });

export function EduLessonView({ slug }: Props) {
  const lesson = EDU_LESSON_BY_SLUG[slug];
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [fusionDeck, setFusionDeck] = useState(() => loadFusionDeck());
  const [lessonGlosses, setLessonGlosses] = useState<string[]>([]);

  const dueCards = useMemo(
    () => dueFusionCards(Object.values(fusionDeck)),
    [fusionDeck],
  );

  useEffect(() => {
    if (!lesson || !VOCAB_LESSONS.has(lesson.id)) return;
    void fetchCurriculumWords(lesson.id).then((words) => {
      setLessonGlosses(words.map((w) => w.gloss));
    });
    void fetchDueFusionCards(getDeviceId()).then((remote) => {
      if (remote.length > 0) {
        setFusionDeck((prev) => mergeFusionCards(prev, remote));
      }
    });
  }, [lesson]);

  useEffect(() => {
    if (!lesson) return;
    setCurrentLesson(lesson.id);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/curriculum/${lesson.file}`);
        if (!res.ok) throw new Error(`Failed to load lesson (${res.status})`);
        const md = await res.text();
        if (!cancelled) setHtml(marked.parse(md) as string);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson]);

  const handleFusionGrade = useCallback((card: FusionCard, good: boolean) => {
    setFusionDeck((prev) => {
      const next = { ...prev, [card.id]: card };
      saveFusionDeck(next);
      return next;
    });
    void postFusionReview(card.id, good, getDeviceId());
  }, []);

  if (!lesson) {
    return (
      <div className="ip-root">
        <div className="ip-error">Unknown lesson.</div>
        <button className="btn-secondary" onClick={() => navigate("/curriculum")}>Back</button>
      </div>
    );
  }

  const idx = EDU_LESSONS.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? EDU_LESSONS[idx - 1] : null;
  const next = idx < EDU_LESSONS.length - 1 ? EDU_LESSONS[idx + 1] : null;
  const showFusion = VOCAB_LESSONS.has(lesson.id);

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
        </div>
        <h1 className="ip-lesson-title" lang="ja">{lesson.titleJa}</h1>
        <p className="ip-lesson-subtitle">{lesson.title} · {lesson.source}</p>
        {lesson.prerequisite && (
          <p className="ip-paste-hint">Prerequisite: {lesson.prerequisite}</p>
        )}
        {showFusion && dueCards.length > 0 && (
          <button type="button" className="btn-primary" onClick={() => setReviewing(true)}>
            Review {dueCards.length} fusion clip{dueCards.length === 1 ? "" : "s"}
          </button>
        )}
      </header>

      {error && <div className="ip-error">{error}</div>}
      {!html && !error && <div className="ip-loading">Loading lesson…</div>}
      {html && (
        <article
          className="ip-lesson-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {showFusion && <FusionClipsSection lessonId={lesson.id} />}

      <footer className="ip-lesson-footer">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            markLessonComplete(lesson.id);
            if (next) navigate(`/curriculum/lesson/${next.slug}`);
            else navigate("/curriculum");
          }}
        >
          {next ? `Mark complete & continue →` : "Mark complete"}
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
          cards={dueCards}
          lessonGlosses={lessonGlosses}
          onGrade={handleFusionGrade}
          onClose={() => setReviewing(false)}
        />
      )}
    </div>
  );
}

export function lessonSlugFromPath(path: string): string | null {
  const m = /^\/curriculum\/lesson\/([^/]+)$/.exec(path);
  return m ? decodeURIComponent(m[1]!) : null;
}
