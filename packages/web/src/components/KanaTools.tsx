import { useCallback, useMemo, useState } from "react";
import { navigate } from "../App";
import {
  allKana,
  groupProgress,
  kanaGroups,
  loadKanaProgress,
  type KanaProgress,
  type KanaScript,
} from "../lib/kana";
import { KanaChart } from "./KanaChart";
import { KanaQuiz, KanaQuizSetup } from "./KanaQuiz";
import { markKanaBaselineDone } from "../lib/profile";
import { markStepComplete } from "../lib/curriculum";

type Tab = "chart" | "quiz";

/** Pass the curriculum kana step once vowels + k/s/t rows each score ≥80%. */
function isKanaThresholdMet(script: KanaScript, progress: KanaProgress): boolean {
  if (script !== "hiragana") return false; // baseline is hiragana-only
  for (const g of ["vowels", "k", "s", "t"]) {
    const { pct } = groupProgress(script, g, progress);
    if (pct < 80) return false;
  }
  return true;
}

const DEFAULT_GROUPS = new Set(
  kanaGroups().filter((g) => g.stage <= 2).map((g) => g.id),
);

export function KanaTools() {
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [tab, setTab] = useState<Tab>("chart");
  const [quizActive, setQuizActive] = useState(false);
  const [weakOnly, setWeakOnly] = useState(false);
  const [enabledGroups, setEnabledGroups] = useState<Set<string>>(
    () => new Set(DEFAULT_GROUPS),
  );
  const [progress, setProgress] = useState<KanaProgress>(() =>
    loadKanaProgress("hiragana"),
  );
  const [highlight, setHighlight] = useState<string | null>(null);

  const refreshProgress = useCallback(
    (s: KanaScript) => setProgress(loadKanaProgress(s)),
    [],
  );

  const switchScript = (s: KanaScript) => {
    setScript(s);
    refreshProgress(s);
    setQuizActive(false);
    setHighlight(null);
  };

  const toggleGroup = (id: string) => {
    setEnabledGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStage = (stage: number, on: boolean) => {
    const ids = kanaGroups().filter((g) => g.stage === stage).map((g) => g.id);
    setEnabledGroups((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const scriptLabel = script === "hiragana" ? "ひらがな" : "カタカナ";
  const chars = useMemo(() => allKana(script), [script]);
  const highlighted = highlight
    ? chars.find((c) => c.char === highlight) ?? null
    : null;

  return (
    <div className="ip-root">
      <header className="ip-header">
        <div>
          <button type="button" className="ip-back" onClick={() => navigate("/")}>
            ← Episodes
          </button>
          <div className="ip-eyebrow">JoyLingo · learning tools</div>
          <h1 className="ip-title">
            Kana <span className="ip-title-en" lang="ja">{scriptLabel}</span>
          </h1>
        </div>
      </header>

      <div className="kana-script-toggle">
        <button
          type="button"
          className={"kana-script-btn" + (script === "hiragana" ? " on" : "")}
          onClick={() => switchScript("hiragana")}
          lang="ja"
        >
          ひらがな
        </button>
        <button
          type="button"
          className={"kana-script-btn" + (script === "katakana" ? " on" : "")}
          onClick={() => switchScript("katakana")}
          lang="ja"
        >
          カタカナ
        </button>
      </div>

      <div className="kana-tab-row">
        <button
          type="button"
          className={"kana-tab" + (tab === "chart" ? " on" : "")}
          onClick={() => {
            setTab("chart");
            setQuizActive(false);
          }}
        >
          Kana chart
        </button>
        <button
          type="button"
          className={"kana-tab" + (tab === "quiz" ? " on" : "")}
          onClick={() => setTab("quiz")}
        >
          Quiz
        </button>
      </div>

      {tab === "chart" && (
        <section className="kana-section">
          <p className="kana-intro">
            All {chars.length}{" "}
            {script === "hiragana" ? "hiragana" : "katakana"} characters — tap
            any cell to see its romaji.
          </p>
          {highlighted && (
            <div className="kana-chart-detail">
              <span className="kana-chart-detail-char" lang="ja">
                {highlighted.char}
              </span>
              <span className="kana-chart-detail-romaji">{highlighted.romaji}</span>
              {progress[highlighted.char] && (
                <span className="kana-chart-detail-stats">
                  {progress[highlighted.char]!.correct} correct ·{" "}
                  {progress[highlighted.char]!.wrong} wrong
                </span>
              )}
            </div>
          )}
          <KanaChart
            script={script}
            highlight={highlight}
            onSelect={(char) => {
              setHighlight(char);
            }}
          />
        </section>
      )}

      {tab === "quiz" && !quizActive && (
        <section className="kana-section">
          <p className="kana-intro">
            Tap row labels (あ行, か行, …) to select whole rows, or use stage
            shortcuts — then type the romaji for each kana, similar to{" "}
            <a href="https://kana.pro" target="_blank" rel="noreferrer">
              Kana Pro
            </a>
            .
          </p>
          <KanaQuizSetup
            script={script}
            enabledGroups={enabledGroups}
            onToggleGroup={toggleGroup}
            onToggleStage={toggleStage}
            onStart={() => {
              setWeakOnly(false);
              setQuizActive(true);
              refreshProgress(script);
            }}
            onStartWeak={() => {
              setWeakOnly(true);
              setQuizActive(true);
              refreshProgress(script);
            }}
            progress={progress}
          />
        </section>
      )}

      {tab === "quiz" && quizActive && (
        <section className="kana-section">
          <KanaQuiz
            script={script}
            groups={enabledGroups}
            weakOnly={weakOnly}
            onExit={() => {
              setQuizActive(false);
              refreshProgress(script);
              // Curriculum hook: passing threshold marks the kana baseline done.
              const fresh = loadKanaProgress(script);
              if (isKanaThresholdMet(script, fresh)) {
                markKanaBaselineDone();
                markStepComplete("kana");
              }
            }}
          />
        </section>
      )}
    </div>
  );
}
