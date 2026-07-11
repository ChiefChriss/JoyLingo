/** School-grade 4-stage practice gate for one short lesson. */
import { useCallback, useMemo, useState } from "react";
import type {
  PracticeItem,
  PracticeSet,
  PracticeSessionState,
  PracticeStage,
} from "@joylingo/shared";
import {
  SECTION_MASTERY_STAGES,
  SCHOOL_PASS_SCORE,
  createPracticeSession,
  gradePracticeAnswer,
  itemsForStage,
  practiceSessionScore,
} from "@joylingo/shared";
import { ModalPortal } from "./ModalPortal";
import { ListenPrompt } from "./ListenPrompt";
import { SpeakPrompt } from "./SpeakPrompt";

export interface StagePassPayload {
  stage: PracticeStage;
  score: number;
  speakingDurationSec?: number;
}

interface Props {
  set: PracticeSet;
  sectionTitle: string;
  /** Called when a graded stage passes (listening/checkpoint/production). */
  onStagePassed: (payload: StagePassPayload) => void;
  /** Called when speaking stage completes successfully. */
  onSpeakingPassed: (durationSec: number) => void;
  /** All four stages done in this session. */
  onFullyMastered: () => void;
  onClose: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  listening: "1 · Listening",
  checkpoint: "2 · Checkpoint",
  production: "3 · Production",
  speaking: "4 · Speaking",
};

export function SectionPracticeModal({
  set,
  sectionTitle,
  onStagePassed,
  onSpeakingPassed,
  onFullyMastered,
  onClose,
}: Props) {
  const stages = useMemo(() => {
    return SECTION_MASTERY_STAGES.filter(
      (st) => itemsForStage(set, st).length > 0,
    );
  }, [set]);

  const [stageIdx, setStageIdx] = useState(0);
  const stage = stages[stageIdx] ?? "checkpoint";

  const [session, setSession] = useState<PracticeSessionState>(() =>
    createPracticeSession(set, stages[0] ?? "checkpoint"),
  );
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    item: PracticeItem;
  } | null>(null);
  const [stageFailed, setStageFailed] = useState(false);
  const [heard, setHeard] = useState(false);

  const current = session.queue[0] ?? null;
  const scorePct = Math.round(practiceSessionScore(session) * 100);
  const progressDone = session.firstAttempts.length;
  const progressTotal = itemsForStage(set, stage).length;
  const passPct = Math.round((set.passScore || SCHOOL_PASS_SCORE) * 100);

  const needsText =
    current &&
    (current.type === "reading" ||
      current.type === "produce" ||
      current.type === "produce_ja" ||
      current.type === "conjugate" ||
      current.type === "translate_en" ||
      current.type === "listen_cloze" ||
      (current.type === "cloze" && !current.choices?.length));

  const needsChoices =
    current &&
    (current.type === "choice" ||
      current.type === "listen_choice" ||
      (current.type === "cloze" && (current.choices?.length ?? 0) > 0));

  const isListenItem =
    current &&
    (current.type === "listen_choice" ||
      current.type === "listen_cloze" ||
      stage === "listening");

  const startStage = useCallback(
    (idx: number) => {
      const st = stages[idx];
      if (!st) return;
      setStageIdx(idx);
      setSession(createPracticeSession(set, st));
      setFeedback(null);
      setInput("");
      setStageFailed(false);
      setHeard(false);
    },
    [set, stages],
  );

  const advanceAfterStage = useCallback(
    (score: number) => {
      onStagePassed({ stage, score });
      const nextIdx = stageIdx + 1;
      if (nextIdx >= stages.length) {
        onFullyMastered();
        return;
      }
      startStage(nextIdx);
    },
    [onFullyMastered, onStagePassed, stage, stageIdx, stages.length, startStage],
  );

  const submit = useCallback(
    (answer: string) => {
      if (!current || feedback) return;
      if (isListenItem && !heard && current.promptJa) {
        // require play first
        return;
      }
      const { next, correct, item } = gradePracticeAnswer(session, answer);
      if (!item) return;
      setFeedback({ correct, item });
      setSession(next);
      setInput("");
    },
    [current, feedback, heard, isListenItem, session],
  );

  const continueAfterFeedback = useCallback(() => {
    if (!feedback) return;
    const next = session;
    setFeedback(null);
    if (next.finished) {
      if (next.passed) {
        advanceAfterStage(practiceSessionScore(next));
      } else {
        setStageFailed(true);
      }
    }
  }, [advanceAfterStage, feedback, session]);

  const restartStage = useCallback(() => {
    startStage(stageIdx);
  }, [stageIdx, startStage]);

  if (stage === "speaking") {
    const speakItem = itemsForStage(set, "speaking")[0];
    return (
      <ModalPortal>
        <div className="ip-modal-backdrop" role="presentation" onClick={onClose}>
          <div
            className="ip-modal ip-section-practice-modal"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ip-section-practice-header">
              <div>
                <div className="ip-section-label">{STAGE_LABEL.speaking}</div>
                <h2 className="ip-section-practice-title">{sectionTitle}</h2>
              </div>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </header>
            <StageDots stages={stages} index={stageIdx} />
            <SpeakPrompt
              prompt={speakItem?.prompt ?? `Speak about: ${sectionTitle}`}
              speakSeconds={speakItem?.speakSeconds ?? 25}
              checklist={
                speakItem?.speakChecklist ?? [
                  "I spoke mostly in Japanese",
                  "I used this lesson's patterns",
                  "I played back my recording",
                ]
              }
              onComplete={(dur) => {
                onSpeakingPassed(dur);
                // Parent records speaking + opens celebration when fully mastered
                onFullyMastered();
              }}
            />
          </div>
        </div>
      </ModalPortal>
    );
  }

  return (
    <ModalPortal>
      <div className="ip-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="ip-modal ip-section-practice-modal"
          role="dialog"
          aria-labelledby="section-practice-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="ip-section-practice-header">
            <div>
              <div className="ip-section-label">
                {STAGE_LABEL[stage] ?? stage} · pass ≥{passPct}%
              </div>
              <h2 id="section-practice-title" className="ip-section-practice-title">
                {sectionTitle}
              </h2>
            </div>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </header>

          <StageDots stages={stages} index={stageIdx} />

          <div className="ip-section-practice-meta">
            <span>
              {Math.min(progressDone, progressTotal)}/{progressTotal} items
            </span>
            <span>First-try: {progressDone ? `${scorePct}%` : "—"}</span>
            <span>Misses re-queued · school standard</span>
          </div>

          {stageFailed ? (
            <div className="ip-section-practice-result">
              <div className="ip-section-practice-result-emoji fail">!</div>
              <h3>Stage not passed</h3>
              <p>
                First-try accuracy was <strong>{scorePct}%</strong> (need ≥{passPct}
                %). Clear every miss, then hit the bar.
              </p>
              <button type="button" className="btn-primary" onClick={restartStage}>
                Retry {STAGE_LABEL[stage]}
              </button>
            </div>
          ) : feedback ? (
            <div
              className={
                "ip-section-practice-feedback" + (feedback.correct ? " ok" : " bad")
              }
            >
              <div className="ip-section-practice-feedback-label">
                {feedback.correct ? "Correct" : "Not quite"}
              </div>
              <p className="ip-section-practice-prompt">{feedback.item.prompt}</p>
              {!feedback.correct && (
                <p>
                  Answer: <strong>{feedback.item.answer}</strong>
                  {feedback.item.promptJa && stage === "listening" && (
                    <>
                      <br />
                      Heard: <span lang="ja">{feedback.item.promptJa}</span>
                    </>
                  )}
                </p>
              )}
              {feedback.item.explain && (
                <p className="ip-paste-hint">{feedback.item.explain}</p>
              )}
              <button type="button" className="btn-primary" onClick={continueAfterFeedback}>
                Next
              </button>
            </div>
          ) : current ? (
            <div className="ip-section-practice-card">
              {isListenItem && current.promptJa && (
                <ListenPrompt
                  promptJa={current.promptJa}
                  audioUrl={current.audioUrl}
                  onPlayed={() => setHeard(true)}
                />
              )}
              <p className="ip-section-practice-prompt" lang="ja">
                {current.prompt}
              </p>
              {current.hint && <p className="ip-paste-hint">{current.hint}</p>}
              {isListenItem && !heard && (
                <p className="ip-paste-hint">Play audio before answering.</p>
              )}

              {needsChoices && current.choices && (
                <div className="ip-section-practice-choices">
                  {current.choices.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="btn-secondary ip-section-practice-choice"
                      disabled={Boolean(isListenItem && !heard)}
                      onClick={() => submit(c)}
                    >
                      <span lang="ja">{c}</span>
                    </button>
                  ))}
                </div>
              )}

              {needsText && (
                <form
                  className="ip-section-practice-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(input);
                  }}
                >
                  <input
                    className="ip-section-practice-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    disabled={Boolean(isListenItem && !heard)}
                    placeholder={
                      stage === "production"
                        ? "type Japanese"
                        : stage === "listening"
                          ? "type what you heard"
                          : "answer"
                    }
                    lang="ja"
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!input.trim() || Boolean(isListenItem && !heard)}
                  >
                    Check
                  </button>
                </form>
              )}
            </div>
          ) : (
            <p className="ip-loading">Loading…</p>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

function StageDots({
  stages,
  index,
}: {
  stages: PracticeStage[];
  index: number;
}) {
  return (
    <div className="ip-stage-dots" aria-label="Practice stages">
      {stages.map((st, i) => (
        <span
          key={st}
          className={
            "ip-stage-dot" + (i < index ? " done" : "") + (i === index ? " on" : "")
          }
          title={STAGE_LABEL[st]}
        >
          {st[0]!.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

/** @deprecated old single-score API — use onStagePassed */
export type { Props as SectionPracticeModalProps };
