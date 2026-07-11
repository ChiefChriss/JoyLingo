/** Mega-lesson unit exam: listening, recognition, production, writing, speaking. */
import { useCallback, useMemo, useState } from "react";
import type { PracticeItem, PracticeSessionState } from "@joylingo/shared";
import {
  createPracticeSession,
  gradePracticeAnswer,
  practiceSessionScore,
  type PracticeSet,
} from "@joylingo/shared";
import {
  buildUnitExam,
  scoreUnitExam,
  type UnitExamBlueprint,
} from "../lib/unit-exam";
import { scoreWriting } from "../lib/writing-rubric";
import type { EduLessonId, EduSection } from "@joylingo/shared";
import { ModalPortal } from "./ModalPortal";
import { ListenPrompt } from "./ListenPrompt";
import { SpeakPrompt } from "./SpeakPrompt";

type Block = "listening" | "recognition" | "production" | "writing" | "speaking" | "result";

interface Props {
  lessonId: EduLessonId;
  lessonTitle: string;
  sections: EduSection[];
  practiceBySection: Map<string, PracticeSet>;
  onPassed: (result: {
    overall: number;
    blockScores: {
      listening: number;
      production: number;
      recognition: number;
      writing: number;
      speaking: boolean;
    };
  }) => void;
  onClose: () => void;
}

function asSet(sectionId: string, items: PracticeItem[], passScore: number): PracticeSet {
  return { sectionId, kind: "mixed", passScore, items };
}

export function UnitExamModal({
  lessonId,
  lessonTitle,
  sections,
  practiceBySection,
  onPassed,
  onClose,
}: Props) {
  const exam: UnitExamBlueprint = useMemo(
    () => buildUnitExam(lessonId, lessonTitle, sections, practiceBySection),
    [lessonId, lessonTitle, sections, practiceBySection],
  );

  const [block, setBlock] = useState<Block>("listening");
  const [scores, setScores] = useState({
    listening: 0,
    recognition: 0,
    production: 0,
    writing: 0,
    speaking: false,
  });
  const [writingText, setWritingText] = useState("");
  const [writingResult, setWritingResult] = useState<ReturnType<typeof scoreWriting> | null>(
    null,
  );
  const [final, setFinal] = useState<ReturnType<typeof scoreUnitExam> | null>(null);

  const runBlock = useCallback(
    (b: "listening" | "recognition" | "production") => {
      const items =
        b === "listening"
          ? exam.listening
          : b === "recognition"
            ? exam.recognition
            : exam.production;
      return asSet(`unit-${b}`, items, exam.passScore);
    },
    [exam],
  );

  const [session, setSession] = useState<PracticeSessionState>(() =>
    createPracticeSession(runBlock("listening")),
  );
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    item: PracticeItem;
  } | null>(null);
  const [input, setInput] = useState("");
  const [heard, setHeard] = useState(false);
  const [blockFailed, setBlockFailed] = useState(false);

  const current = session.queue[0] ?? null;

  const startBlock = (b: Block) => {
    setBlock(b);
    setFeedback(null);
    setInput("");
    setHeard(false);
    setBlockFailed(false);
    if (b === "listening" || b === "recognition" || b === "production") {
      setSession(createPracticeSession(runBlock(b)));
    }
  };

  const finishGradedBlock = (b: "listening" | "recognition" | "production", score: number) => {
    setScores((s) => ({ ...s, [b]: score }));
    if (b === "listening") startBlock("recognition");
    else if (b === "recognition") startBlock("production");
    else startBlock("writing");
  };

  const submit = (answer: string) => {
    if (!current || feedback) return;
    if (
      (current.type === "listen_choice" || current.type === "listen_cloze") &&
      !heard &&
      current.promptJa
    ) {
      return;
    }
    const { next, correct, item } = gradePracticeAnswer(session, answer);
    if (!item) return;
    setFeedback({ correct, item });
    setSession(next);
    setInput("");
  };

  const afterFeedback = () => {
    if (!feedback) return;
    const next = session;
    setFeedback(null);
    if (!next.finished) return;
    if (!next.passed) {
      setBlockFailed(true);
      return;
    }
    const score = practiceSessionScore(next);
    if (block === "listening" || block === "recognition" || block === "production") {
      finishGradedBlock(block, score);
    }
  };

  const submitWriting = () => {
    const wr = scoreWriting(writingText, exam.writingCriteria, 3);
    setWritingResult(wr);
    setScores((s) => ({ ...s, writing: wr.score }));
    startBlock("speaking");
  };

  const finishSpeaking = (dur: number) => {
    void dur;
    const speaking = true;
    const nextScores = { ...scores, speaking };
    setScores(nextScores);
    const wr =
      writingResult ?? scoreWriting(writingText, exam.writingCriteria, 3);
    const result = scoreUnitExam({
      listening: nextScores.listening,
      recognition: nextScores.recognition,
      production: nextScores.production,
      writing: wr,
      speaking,
    });
    setFinal(result);
    setBlock("result");
    if (result.passed) {
      onPassed({ overall: result.overall, blockScores: result.blockScores });
    }
  };

  return (
    <ModalPortal>
      <div className="ip-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="ip-modal ip-section-practice-modal ip-unit-exam-modal"
          role="dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="ip-section-practice-header">
            <div>
              <div className="ip-section-label">Unit exam · ≥85% overall + skill floors</div>
              <h2 className="ip-section-practice-title">{lessonTitle}</h2>
            </div>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </header>

          <p className="ip-paste-hint">
            Block: <strong>{block}</strong> · Listening 25% · Production 35% · Recognition 15% ·
            Writing 15% · Speaking 10%
          </p>

          {block === "result" && final && (
            <div className="ip-section-practice-result">
              <div
                className={
                  "ip-section-practice-result-emoji" + (final.passed ? "" : " fail")
                }
              >
                {final.passed ? "★" : "!"}
              </div>
              <h3>{final.passed ? "Unit ready" : "Unit exam not passed"}</h3>
              <p>
                Overall <strong>{Math.round(final.overall * 100)}%</strong>
                {final.floorsOk ? "" : " · a skill floor failed (need ≥70% each block + writing 3/4 + speak)"}
              </p>
              <ul className="ip-section-practice-misses">
                <li>Listening {Math.round(final.blockScores.listening * 100)}%</li>
                <li>Production {Math.round(final.blockScores.production * 100)}%</li>
                <li>Recognition {Math.round(final.blockScores.recognition * 100)}%</li>
                <li>Writing {Math.round(final.blockScores.writing * 100)}%</li>
                <li>Speaking {final.blockScores.speaking ? "yes" : "no"}</li>
              </ul>
              {!final.passed && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setFinal(null);
                    setWritingResult(null);
                    setWritingText("");
                    startBlock("listening");
                  }}
                >
                  Retry unit exam
                </button>
              )}
              {final.passed && (
                <button type="button" className="btn-primary" onClick={onClose}>
                  Continue
                </button>
              )}
            </div>
          )}

          {block === "writing" && (
            <div className="ip-section-practice-card">
              <p className="ip-section-practice-prompt">{exam.writingPrompt}</p>
              <textarea
                className="ip-unit-writing"
                rows={5}
                value={writingText}
                onChange={(e) => setWritingText(e.target.value)}
                lang="ja"
                placeholder="日本語で書いてください…"
              />
              <button
                type="button"
                className="btn-primary"
                disabled={writingText.trim().length < 10}
                onClick={submitWriting}
              >
                Submit writing
              </button>
            </div>
          )}

          {block === "speaking" && (
            <SpeakPrompt
              prompt={exam.speakPrompt}
              speakSeconds={exam.speakSeconds}
              checklist={exam.speakChecklist}
              onComplete={finishSpeaking}
            />
          )}

          {(block === "listening" ||
            block === "recognition" ||
            block === "production") &&
            !blockFailed &&
            !feedback &&
            current && (
              <div className="ip-section-practice-card">
                {(current.type === "listen_choice" || current.type === "listen_cloze") &&
                  current.promptJa && (
                    <ListenPrompt
                      promptJa={current.promptJa}
                      onPlayed={() => setHeard(true)}
                    />
                  )}
                <p className="ip-section-practice-prompt">{current.prompt}</p>
                {current.choices ? (
                  <div className="ip-section-practice-choices">
                    {current.choices.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="btn-secondary ip-section-practice-choice"
                        onClick={() => submit(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : (
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
                      lang="ja"
                    />
                    <button type="submit" className="btn-primary" disabled={!input.trim()}>
                      Check
                    </button>
                  </form>
                )}
              </div>
            )}

          {feedback && (block === "listening" || block === "recognition" || block === "production") && (
            <div
              className={
                "ip-section-practice-feedback" + (feedback.correct ? " ok" : " bad")
              }
            >
              <div className="ip-section-practice-feedback-label">
                {feedback.correct ? "Correct" : "Not quite"}
              </div>
              {!feedback.correct && (
                <p>
                  Answer: <strong>{feedback.item.answer}</strong>
                </p>
              )}
              <button type="button" className="btn-primary" onClick={afterFeedback}>
                Next
              </button>
            </div>
          )}

          {blockFailed && (
            <div className="ip-section-practice-result">
              <h3>Block failed</h3>
              <p>Need ≥{Math.round(exam.passScore * 100)}% first-try on this block.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => startBlock(block)}
              >
                Retry block
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
