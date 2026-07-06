/** Home widget: shows current curriculum step + CTA. */
import { useMemo } from "react";
import type { UserProfile, VocabularyMap } from "@joylingo/shared";
import { getNextStep, isStepDone, STEP_META, STEP_ORDER, type StepId } from "@joylingo/shared";
import {
  loadCurriculumProgress,
  markStepComplete,
  setCurrentStep,
} from "../lib/curriculum";
import { navigate } from "../App";

interface Props {
  profile: UserProfile;
  vocabulary: VocabularyMap;
  hasWatched?: boolean;
  hasReviewed?: boolean;
  /** Full-page layout (curriculum tab) vs compact home widget. */
  expanded?: boolean;
  /** Opens the anime episode picker (immersion curriculum step). */
  onPickEpisode?: () => void;
}

export function CurriculumPath({
  profile,
  vocabulary,
  hasWatched,
  hasReviewed,
  expanded,
  onPickEpisode,
}: Props) {
  const progress = useMemo(() => loadCurriculumProgress(), []);
  const stepInput = useMemo(
    () => ({
      profile,
      progress,
      vocabulary,
      hasWatched: Boolean(hasWatched),
      hasReviewed: Boolean(hasReviewed),
    }),
    [profile, progress, vocabulary, hasWatched, hasReviewed],
  );
  const { step, index, total, allDone } = useMemo(
    () => getNextStep(stepInput),
    [stepInput],
  );

  const onCta = () => {
    if (step.id === "immersion" && onPickEpisode) {
      onPickEpisode();
      return;
    }
    if (step.ctaLink) {
      navigate(step.ctaLink);
      return;
    }
    setCurrentStep(step.id);
    if (step.id === "mine" || step.id === "review") {
      navigate("/");
    }
  };

  return (
    <section className={"ip-curriculum" + (expanded ? " ip-curriculum-expanded" : "")}>
      <div className="ip-curriculum-head">
        <div className="ip-section-label">Your learning path</div>
        <h2 className="ip-curriculum-title">
          {allDone ? "Path complete 🎉" : step.title}
        </h2>
        <p className="ip-paste-hint">{step.detail}</p>
      </div>

      <div className="ip-curriculum-progress">
        <div className="ip-curriculum-bar">
          <div
            className="ip-curriculum-bar-fill"
            style={{ width: `${(index / Math.max(1, total)) * 100}%` }}
          />
        </div>
        <div className="ip-curriculum-count">Step {index + 1} / {total}</div>
      </div>

      <ol className="ip-curriculum-steps">
        {STEP_ORDER.filter((s) =>
          profile.jlptGoal && profile.jlptGoal !== "anime_only" ? true : s !== "jlpt",
        ).map((s) => (
          <CurriculumRow
            key={s}
            stepId={s}
            done={isStepDone(s, stepInput)}
            active={step.id === s}
          />
        ))}
      </ol>

      <div className="ip-onboarding-actions">
        <button type="button" className="btn-primary" onClick={onCta}>{step.ctaLabel}</button>
        {step.id === "kana" && (
          <button
            className="kana-link"
            onClick={() => {
              // Power-user shortcut: someone fluent in kana can self-mark.
              markStepComplete("kana");
              navigate(expanded ? "/curriculum" : "/");
            }}
          >
            Skip — I already know kana
          </button>
        )}
        {!expanded && (
          <button
            type="button"
            className="kana-link"
            onClick={() => navigate("/curriculum")}
          >
            View full curriculum →
          </button>
        )}
      </div>
    </section>
  );
}

function CurriculumRow({
  stepId,
  done,
  active,
}: {
  stepId: StepId;
  done: boolean;
  active: boolean;
}) {
  const meta = STEP_META[stepId];
  return (
    <li
      className={
        "ip-curriculum-row" +
        (done ? " done" : "") +
        (active ? " active" : "")
      }
    >
      <span className="ip-curriculum-row-dot">{done ? "✓" : active ? "→" : "•"}</span>
      <span className="ip-curriculum-row-title">{meta.title}</span>
      <span className="ip-curriculum-row-detail">{meta.detail}</span>
    </li>
  );
}