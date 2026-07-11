/** Dedicated curriculum tab — learning path + long-term goals. */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { UserProfile, VocabularyMap } from "@joylingo/shared";
import {
  countEpisodesWatched,
  countMinedWords,
  countTappedWords,
  evaluateGoals,
  getPathCompletion,
  GOAL_CATEGORY_LABELS,
  type GoalCategory,
  type GoalStatus,
} from "@joylingo/shared";
import { deriveKanjiProgress } from "@joylingo/player-core";
import { loadCurriculumProgress } from "../lib/curriculum";
import { loadKanaProgress, scriptOverallPct } from "../lib/kana";
import { loadVocabulary, mergeVocabularyMaps, onVocabularyHydrated } from "../lib/vocabulary";
import { loadProfile } from "../lib/profile";
import { navigate } from "../App";
import { SiteNav } from "./SiteNav";
import { ModalPortal } from "./ModalPortal";
import type { AnimeLearnModalProps } from "./AnimeLearnModal";

import { loadEduProgress } from "../lib/edu-curriculum";
import { EduLessonList } from "./EduLessonList";

const CurriculumPath = lazy(() =>
  import("./CurriculumPath").then((m) => ({ default: m.CurriculumPath })),
);
const AnimeLearnModal = lazy(() =>
  import("./AnimeLearnModal").then((m) => ({ default: m.AnimeLearnModal })),
);

type Tab = "lessons" | "path" | "goals";

export function CurriculumPage() {
  const [tab, setTab] = useState<Tab>("lessons");
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [vocabulary, setVocabulary] = useState<VocabularyMap>(() => loadVocabulary());
  const [progressVersion, setProgressVersion] = useState(0);
  const [showAnimeModal, setShowAnimeModal] = useState(false);
  const [animeModalPrefill, setAnimeModalPrefill] =
    useState<AnimeLearnModalProps["prefill"]>(null);

  useEffect(() => {
    const refresh = () => {
      setProfile(loadProfile());
      setVocabulary(loadVocabulary());
      setProgressVersion((v) => v + 1);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("joylingo:") || e.key === null) refresh();
    };
    const onFocus = () => refresh();
    const onEdu = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("joylingo:edu-progress", onEdu);
    document.addEventListener("visibilitychange", onFocus);
    const offHydrate = onVocabularyHydrated((merged) => {
      setProfile(loadProfile());
      setVocabulary((prev) => mergeVocabularyMaps(prev, merged));
      setProgressVersion((v) => v + 1);
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("joylingo:edu-progress", onEdu);
      document.removeEventListener("visibilitychange", onFocus);
      offHydrate();
    };
  }, []);

  useEffect(() => {
    if (!showAnimeModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAnimeModal]);

  const progress = useMemo(() => loadCurriculumProgress(), [progressVersion]);
  const eduProgress = useMemo(() => loadEduProgress(), [progressVersion]);

  const snapshot = useMemo(() => {
    const kanji = deriveKanjiProgress(vocabulary);
    return {
      minedWords: countMinedWords(vocabulary),
      tappedWords: countTappedWords(vocabulary),
      kanjiEncountered: Object.keys(kanji).length,
      episodesWatched: Math.max(
        countEpisodesWatched(vocabulary),
        progress.completedStepIds.includes("immersion") ? 1 : 0,
      ),
      kanaBaselineDone: profile.kanaBaselineDone,
      hiraganaPct: scriptOverallPct("hiragana", loadKanaProgress("hiragana")),
      katakanaPct: scriptOverallPct("katakana", loadKanaProgress("katakana")),
      hasWatched: progress.completedStepIds.includes("immersion"),
      hasReviewed: progress.completedStepIds.includes("review"),
    };
  }, [vocabulary, profile, progress]);

  const pathCompletion = useMemo(
    () =>
      getPathCompletion({
        profile,
        progress,
        vocabulary,
        hasWatched: snapshot.hasWatched,
        hasReviewed: snapshot.hasReviewed,
      }),
    [profile, progress, vocabulary, snapshot],
  );

  const goals = useMemo(
    () => evaluateGoals(profile, snapshot, progress),
    [profile, snapshot, progress],
  );

  const goalsDone = goals.filter((g) => g.done).length;
  const goalsByCategory = useMemo(() => {
    const map = new Map<GoalCategory, GoalStatus[]>();
    for (const g of goals) {
      const list = map.get(g.category) ?? [];
      list.push(g);
      map.set(g.category, list);
    }
    return map;
  }, [goals]);

  const openAnimePicker = (prefill?: AnimeLearnModalProps["prefill"]) => {
    setAnimeModalPrefill(prefill ?? null);
    setShowAnimeModal(true);
  };

  const goalCta = (goal: GoalStatus) => {
    if (goal.ctaLink) {
      navigate(goal.ctaLink);
      return;
    }
    const first = profile.favoriteAnime[0];
    openAnimePicker(first ? { malId: first.malId, title: first.title } : null);
  };

  return (
    <div className="ip-root ip-home ip-curriculum-page">
      <SiteNav active="curriculum" />

      <section className="ip-hero ip-curriculum-hero">
        <div className="ip-hero-glow" aria-hidden />
        <div className="ip-hero-content">
          <div className="ip-eyebrow">Japanese curriculum</div>
          <h1 className="ip-hero-title">
            Genki &amp; Tobira <span className="ip-hero-accent">learning path</span>
          </h1>
          <p className="ip-hero-sub">
            Structured lessons from Genki I &amp; II and Tobira, plus immersion goals in JoyLingo.
          </p>
          {profile.jlptGoal && profile.jlptGoal !== "anime_only" && (
            <div className="ip-hero-badges">
              <span className="chip chip-amber">Goal: {profile.jlptGoal}</span>
            </div>
          )}
        </div>
      </section>

      <section className="ip-curriculum-stats">
        <StatCard
          label="Lessons"
          value={`${eduProgress.completedLessonIds.length}/7`}
          sub="completed"
        />
        <StatCard label="Path" value={`${pathCompletion.done}/${pathCompletion.total}`} sub="immersion steps" />
        <StatCard label="Goals" value={`${goalsDone}/${goals.length}`} sub="achieved" />
        <StatCard label="Mined" value={String(snapshot.minedWords)} sub="words in deck" />
      </section>

      <div className="kana-tab-row ip-curriculum-tabs">
        <button
          type="button"
          className={"kana-tab" + (tab === "lessons" ? " on" : "")}
          onClick={() => setTab("lessons")}
        >
          Lessons
        </button>
        <button
          type="button"
          className={"kana-tab" + (tab === "path" ? " on" : "")}
          onClick={() => setTab("path")}
        >
          Immersion path
        </button>
        <button
          type="button"
          className={"kana-tab" + (tab === "goals" ? " on" : "")}
          onClick={() => setTab("goals")}
        >
          Goals
        </button>
      </div>

      {tab === "lessons" && (
        <EduLessonList
          completedIds={eduProgress.completedLessonIds}
          currentId={eduProgress.currentLessonId}
          placement={eduProgress.placement}
        />
      )}

      {tab === "path" && (
        <Suspense fallback={<div className="ip-loading">Loading path…</div>}>
          <CurriculumPath
            profile={profile}
            vocabulary={vocabulary}
            expanded
            hasWatched={snapshot.hasWatched}
            hasReviewed={snapshot.hasReviewed}
            onPickEpisode={() => {
              const first = profile.favoriteAnime[0];
              openAnimePicker(
                first ? { malId: first.malId, title: first.title } : null,
              );
            }}
          />
        </Suspense>
      )}

      {tab === "goals" && (
        <section className="ip-curriculum-goals">
          {Array.from(goalsByCategory.entries()).map(([category, items]) => (
            <div key={category} className="ip-curriculum-goal-group">
              <div className="ip-section-label">{GOAL_CATEGORY_LABELS[category]}</div>
              <ul className="ip-curriculum-goal-list">
                {items.map((goal) => (
                  <GoalRow key={goal.id} goal={goal} onCta={() => goalCta(goal)} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {showAnimeModal && (
        <Suspense
          fallback={
            <ModalPortal>
              <div className="ip-modal-backdrop">
                <div className="ip-modal">
                  <div className="ip-loading">Opening episode picker…</div>
                </div>
              </div>
            </ModalPortal>
          }
        >
          <AnimeLearnModal
            key={animeModalPrefill ? `pick-${animeModalPrefill.malId}` : "search"}
            prefill={animeModalPrefill}
            onClose={() => {
              setShowAnimeModal(false);
              setAnimeModalPrefill(null);
            }}
            onImported={(episodeId) => {
              setShowAnimeModal(false);
              setAnimeModalPrefill(null);
              setVocabulary(loadVocabulary());
              setProgressVersion((v) => v + 1);
              navigate(`/watch/${encodeURIComponent(episodeId)}`);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="ip-curriculum-stat">
      <div className="ip-curriculum-stat-label">{label}</div>
      <div className="ip-curriculum-stat-value">{value}</div>
      <div className="ip-curriculum-stat-sub">{sub}</div>
    </div>
  );
}

function GoalRow({ goal, onCta }: { goal: GoalStatus; onCta: () => void }) {
  const pct = goal.target <= 1
    ? goal.done ? 100 : 0
    : Math.min(100, Math.round((goal.current / goal.target) * 100));
  const progressLabel = goal.target <= 1
    ? goal.done ? "Done" : "Not yet"
    : `${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}`;

  return (
    <li className={"ip-curriculum-goal" + (goal.done ? " done" : "")}>
      <div className="ip-curriculum-goal-head">
        <span className="ip-curriculum-goal-title">{goal.title}</span>
        <span className="ip-curriculum-goal-count">{progressLabel}</span>
      </div>
      <p className="ip-curriculum-goal-detail">{goal.detail}</p>
      <div className="ip-curriculum-bar ip-curriculum-goal-bar">
        <div
          className="ip-curriculum-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!goal.done && goal.ctaLabel && (
        <button type="button" className="btn-secondary ip-curriculum-goal-cta" onClick={onCta}>
          {goal.ctaLabel}
        </button>
      )}
    </li>
  );
}
