import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allKana,
  buildKanaQueue,
  groupProgress,
  kanaGroups,
  loadKanaProgress,
  requeueAfterMiss,
  romajiMatches,
  saveKanaProgress,
  getWeakKana,
  type KanaChar,
  type KanaProgress,
  type KanaScript,
} from "../lib/kana";
import { KanaChart } from "./KanaChart";

interface Props {
  script: KanaScript;
  /** Enabled group ids */
  groups: Set<string>;
  /** Drill only characters with more wrong than correct answers. */
  weakOnly?: boolean;
  onExit: () => void;
}

export function KanaQuiz({ script, groups, weakOnly, onExit }: Props) {
  const pool = useMemo(
    () => allKana(script).filter((k) => groups.has(k.groupId)),
    [script, groups],
  );

  const [queue, setQueue] = useState<KanaChar[]>(() => {
    const progress = loadKanaProgress(script);
    return buildKanaQueue(pool, progress, { weakOnly });
  });
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [progress, setProgress] = useState<KanaProgress>(() => loadKanaProgress(script));
  const [stats, setStats] = useState({ correct: 0, wrong: 0, streak: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const current = queue[idx] ?? null;

  const record = useCallback(
    (char: string, ok: boolean) => {
      setProgress((prev) => {
        const p = prev[char] ?? { correct: 0, wrong: 0 };
        const next = {
          ...prev,
          [char]: ok
            ? { correct: p.correct + 1, wrong: p.wrong }
            : { correct: p.correct, wrong: p.wrong + 1 },
        };
        saveKanaProgress(script, next);
        return next;
      });
    },
    [script],
  );

  const advance = useCallback(
    (ok: boolean) => {
      if (!current) return;
      record(current.char, ok);
      setStats((s) => ({
        correct: s.correct + (ok ? 1 : 0),
        wrong: s.wrong + (ok ? 0 : 1),
        streak: ok ? s.streak + 1 : 0,
      }));

      setFeedback(ok ? "correct" : "wrong");
      setTimeout(() => {
        setFeedback(null);
        setInput("");
        setIdx((i) => {
          const next = i + 1;
          if (!ok && current) {
            setQueue((q) => requeueAfterMiss(q, current, i));
          }
          if (next >= queue.length) {
            const progress = loadKanaProgress(script);
            setQueue(buildKanaQueue(pool, progress, { weakOnly }));
            return 0;
          }
          return next;
        });
      }, ok ? 400 : 900);
    },
    [current, pool, queue.length, record],
  );

  const submit = () => {
    if (!current || feedback) return;
    const ok = romajiMatches(input, current.romaji);
    advance(ok);
  };

  useEffect(() => {
    if (!feedback) inputRef.current?.focus();
  }, [current, feedback]);

  if (pool.length === 0 || (weakOnly && queue.length === 0)) {
    return (
      <div className="kana-quiz-empty">
        {weakOnly
          ? "No weak characters in the selected rows — nice work!"
          : "Select at least one character group to start."}
        <button type="button" className="btn-again" onClick={onExit}>
          Back to setup
        </button>
      </div>
    );
  }

  return (
    <div className={"kana-quiz" + (feedback ? ` kana-quiz-${feedback}` : "")}>
      <div className="kana-quiz-top">
        <span className="kana-quiz-stat">
          ✓ {stats.correct} · ✗ {stats.wrong}
          {stats.streak >= 3 && (
            <span className="kana-quiz-streak"> · {stats.streak} streak</span>
          )}
        </span>
        <button type="button" className="kana-quiz-exit" onClick={onExit}>
          End quiz
        </button>
      </div>

      <div className="kana-quiz-prompt" lang="ja">
        {current?.char}
      </div>
      <div className="kana-quiz-hint">Type the romaji reading</div>

      <form
        className="kana-quiz-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!!feedback}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="e.g. ka"
          aria-label="Romaji answer"
        />
        <button type="submit" className="btn-primary" disabled={!input.trim() || !!feedback}>
          Check
        </button>
      </form>

      {feedback === "wrong" && current && (
        <div className="kana-quiz-answer">
          Answer: <strong>{current.romaji}</strong>
          <span className="kana-quiz-retry-hint"> — you&apos;ll see this one again soon</span>
        </div>
      )}

      <div className="kana-quiz-progress-bar">
        <div
          className="kana-quiz-progress-fill"
          style={{ width: `${((idx + 1) / queue.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Group picker + stage toggles for quiz setup (kana.pro-style). */
export function KanaQuizSetup({
  script,
  enabledGroups,
  onToggleGroup,
  onToggleStage,
  onStart,
  onStartWeak,
  progress,
}: {
  script: KanaScript;
  enabledGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  onToggleStage: (stage: number, on: boolean) => void;
  onStart: () => void;
  onStartWeak: () => void;
  progress: KanaProgress;
}) {
  const groups = kanaGroups();
  const stages = [1, 2, 3, 4, 5] as const;
  const stageLabels = ["Basics I", "Basics II", "More", "Dakuten", "Yōon"];

  const weakChars = useMemo(
    () => getWeakKana(script, progress, enabledGroups),
    [script, progress, enabledGroups],
  );

  const stageOn = (stage: number) =>
    groups.filter((g) => g.stage === stage).every((g) => enabledGroups.has(g.id));

  const toggleStage = (stage: number) => {
    onToggleStage(stage, !stageOn(stage));
  };

  const charCount = useMemo(
    () => allKana(script).filter((k) => enabledGroups.has(k.groupId)).length,
    [script, enabledGroups],
  );

  const selectedGroups = useMemo(
    () => groups.filter((g) => enabledGroups.has(g.id)),
    [groups, enabledGroups],
  );

  return (
    <div className="kana-setup">
      <div className="kana-setup-summary">
        <div className="kana-setup-summary-head">
          <div>
            <div className="kana-setup-summary-count">
              {enabledGroups.size} row{enabledGroups.size === 1 ? "" : "s"} · {charCount} character
              {charCount === 1 ? "" : "s"}
            </div>
            <div className="kana-setup-summary-hint">
              {enabledGroups.size === 0
                ? "Tap a row label on the chart to select it"
                : "Tap row labels to toggle whole rows"}
            </div>
          </div>
          <button
            type="button"
            className="btn-primary kana-setup-start"
            disabled={enabledGroups.size === 0}
            onClick={onStart}
          >
            Start quiz
          </button>
          {weakChars.length > 0 && (
            <button
              type="button"
              className="btn-secondary kana-setup-start"
              onClick={onStartWeak}
            >
              Practice {weakChars.length} weak
            </button>
          )}
        </div>
        {weakChars.length > 0 && (
          <div className="kana-weak-panel">
            <div className="ip-section-label">Needs practice</div>
            <p className="kana-weak-hint">
              These characters have more wrong than correct answers. The quiz
              weights them higher and brings misses back within a few cards.
            </p>
            <div className="kana-weak-chars">
              {weakChars.slice(0, 24).map((k) => {
                const p = progress[k.char];
                return (
                  <span key={k.char} className="kana-weak-chip" lang="ja" title={k.romaji}>
                    {k.char}
                    {p && <span className="kana-weak-chip-stats">{p.wrong}✗</span>}
                  </span>
                );
              })}
              {weakChars.length > 24 && (
                <span className="kana-weak-more">+{weakChars.length - 24} more</span>
              )}
            </div>
          </div>
        )}
        {selectedGroups.length > 0 && (
          <div className="kana-setup-chips">
            {selectedGroups.map((g) => {
              const { pct } = groupProgress(script, g.id, progress);
              return (
                <button
                  key={g.id}
                  type="button"
                  className="kana-setup-chip"
                  onClick={() => onToggleGroup(g.id)}
                  title={`Remove ${g.labelJa}`}
                >
                  <span lang="ja">{g.labelJa}</span>
                  <span className="kana-setup-chip-meta">{pct}%</span>
                  <span className="kana-setup-chip-x" aria-hidden>✕</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="kana-setup-stages">
        <div className="ip-section-label">Stages</div>
        <div className="kana-stage-row">
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              className={"kana-stage-btn" + (stageOn(s) ? " on" : "")}
              onClick={() => toggleStage(s)}
            >
              {s}. {stageLabels[s - 1]}
            </button>
          ))}
        </div>
        <div className="kana-stage-actions">
          <button
            type="button"
            className="kana-link"
            onClick={() => stages.forEach((s) => onToggleStage(s, true))}
          >
            All stages
          </button>
          <span className="kana-sep">·</span>
          <button
            type="button"
            className="kana-link"
            onClick={() => stages.forEach((s) => onToggleStage(s, false))}
          >
            Clear stages
          </button>
        </div>
      </div>

      <KanaChart
        script={script}
        mode="select"
        enabledGroups={enabledGroups}
        onToggleGroup={onToggleGroup}
      />
    </div>
  );
}
