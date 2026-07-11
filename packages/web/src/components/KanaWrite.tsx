/** Write-practice mode: draw kana; graded strictly by stroke count + shape (not OCR). */
import { useCallback, useMemo, useState } from "react";
import {
  allKana,
  buildKanaQueue,
  loadKanaProgress,
  requeueAfterMiss,
  saveKanaProgress,
  type KanaChar,
  type KanaProgress,
  type KanaScript,
} from "../lib/kana";
import {
  expectedStrokeCount,
  gradeKanaInk,
  type GradeResult,
  type Stroke,
} from "../lib/kana-strokes";
import { KanaDrawingBoard } from "./KanaDrawingBoard";

interface WriteProps {
  script: KanaScript;
  groups: Set<string>;
  weakOnly?: boolean;
  onExit: () => void;
}

export function KanaWrite({ script, groups, weakOnly, onExit }: WriteProps) {
  const pool = useMemo(
    () => allKana(script).filter((k) => groups.has(k.groupId)),
    [script, groups],
  );

  const [queue, setQueue] = useState<KanaChar[]>(() => {
    const progress = loadKanaProgress(script);
    return buildKanaQueue(pool, progress, { weakOnly });
  });
  const [idx, setIdx] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, streak: 0 });
  const [boardKey, setBoardKey] = useState(0);

  const current = queue[idx] ?? null;

  const record = useCallback(
    (char: string, ok: boolean) => {
      const prev = loadKanaProgress(script);
      const p = prev[char] ?? { correct: 0, wrong: 0 };
      const next: KanaProgress = {
        ...prev,
        [char]: ok
          ? { correct: p.correct + 1, wrong: p.wrong }
          : { correct: p.correct, wrong: p.wrong + 1 },
      };
      saveKanaProgress(script, next);
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

      window.setTimeout(
        () => {
          setResult(null);
          setStrokes([]);
          setBoardKey((k) => k + 1);
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
        },
        ok ? 700 : 1600,
      );
    },
    [current, pool, queue.length, record, script, weakOnly],
  );

  const check = () => {
    if (!current || result) return;
    const grade = gradeKanaInk(strokes, current.char);
    setResult(grade);
    advance(grade.pass);
  };

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

  const expected = current ? expectedStrokeCount(current.char) : null;
  const feedbackClass =
    result == null ? "" : result.pass ? " kana-quiz-correct" : " kana-quiz-wrong";

  return (
    <div className={"kana-write" + feedbackClass}>
      <div className="kana-quiz-top">
        <span className="kana-quiz-stat">
          ✓ {stats.correct} · ✗ {stats.wrong}
          {stats.streak >= 3 && (
            <span className="kana-quiz-streak"> · {stats.streak} streak</span>
          )}
        </span>
        <button type="button" className="kana-quiz-exit" onClick={onExit}>
          End write practice
        </button>
      </div>

      <div className="kana-write-prompt">
        <div className="kana-write-romaji">{current?.romaji}</div>
        <div className="kana-write-hint">
          Draw the {script === "hiragana" ? "hiragana" : "katakana"}
          {expected != null && (
            <span className="kana-write-stroke-hint">
              {" "}
              · {expected} stroke{expected === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <KanaDrawingBoard
        resetKey={`${current?.char ?? ""}-${boardKey}`}
        guideChar={current?.char}
        showGuide={showGuide}
        disabled={!!result}
        onStrokesChange={setStrokes}
      />

      <div className="kana-write-controls">
        <label className="kana-write-guide-toggle">
          <input
            type="checkbox"
            checked={showGuide}
            onChange={(e) => setShowGuide(e.target.checked)}
            disabled={!!result}
          />
          Show guide
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={!!result || strokes.length === 0}
          onClick={check}
        >
          Check writing
        </button>
      </div>

      {result && (
        <div className={"kana-write-result" + (result.pass ? " ok" : " bad")}>
          <div className="kana-write-result-head">
            {result.pass ? "Accepted" : "Not quite"}
            <span className="kana-write-score">
              {" "}
              · shape {Math.round(result.shapeScore * 100)}%
              {result.strokeScore != null &&
                ` · strokes ${Math.round(result.strokeScore * 100)}%`}
            </span>
          </div>
          <ul className="kana-write-reasons">
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {!result.pass && current && (
            <div className="kana-write-reveal" lang="ja">
              Target: <strong>{current.char}</strong> ({current.romaji})
            </div>
          )}
        </div>
      )}

      <div className="kana-quiz-progress-bar">
        <div
          className="kana-quiz-progress-fill"
          style={{
            width: `${queue.length ? ((idx + 1) / queue.length) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
