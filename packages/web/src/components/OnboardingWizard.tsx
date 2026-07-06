/** Device-local onboarding wizard: pick 3–5 anime → optional JLPT goal → kana check → home. */
import { useMemo, useState } from "react";
import type { JlptGoal, UserProfile, FavoriteAnime } from "@joylingo/shared";
import { AnimeSearchPicker } from "./AnimeSearchPicker";
import { loadProfile } from "../lib/profile";
import type { AnimeSummary } from "../lib/api";
import { shuffle } from "../lib/kana";

interface Props {
  /** Called with the final profile; App navigates to `/`. */
  onComplete: (profile: UserProfile) => void;
}

type StepId = "welcome" | "anime" | "jlpt" | "kana" | "done";

const MIN_PICKS = 3;
const MAX_PICKS_RECOMMENDED = 5;

const STEP_LABELS: Record<StepId, string> = {
  welcome: "Welcome",
  anime: "Anime",
  jlpt: "Goal",
  kana: "Kana",
  done: "Done",
};

const JLPT_OPTIONS: { id: JlptGoal; label: string; hint: string }[] = [
  { id: "N5", label: "N5", hint: "Beginner — everyday phrases" },
  { id: "N4", label: "N4", hint: "Basic conversational" },
  { id: "N3", label: "N3", hint: "Intermediate bridge" },
  { id: "N2", label: "N2", hint: "Most business contexts" },
  { id: "N1", label: "N1", hint: "Advanced / native-level" },
  { id: "anime_only", label: "Anime only", hint: "No JLPT goal — immersion first" },
];

/** 5 quick kana prompts drawn from vowels + k/s/t rows (stages 1). */
const KANA_PROMPTS: { char: string; romaji: string }[] = [
  { char: "あ", romaji: "a" },
  { char: "い", romaji: "i" },
  { char: "う", romaji: "u" },
  { char: "え", romaji: "e" },
  { char: "お", romaji: "o" },
  { char: "か", romaji: "ka" },
  { char: "き", romaji: "ki" },
  { char: "さ", romaji: "sa" },
  { char: "し", romaji: "shi" },
  { char: "た", romaji: "ta" },
  { char: "ち", romaji: "chi" },
  { char: "つ", romaji: "tsu" },
];

const PASS_THRESHOLD = 0.8;

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<StepId>("welcome");
  const [picks, setPicks] = useState<Map<number, FavoriteAnime>>(() => {
    const seed = loadProfile().favoriteAnime;
    return new Map(seed.map((a) => [a.malId, a]));
  });
  const [jlpt, setJlpt] = useState<JlptGoal | null>(() => loadProfile().jlptGoal ?? null);
  const [mode, setMode] = useState<"sub" | "dub">(() => loadProfile().preferredStreamMode);
  const [kanaResult, setKanaResult] = useState<"pass" | "fail" | null>(null);

  const togglePick = (a: AnimeSummary) => {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.has(a.malId)) next.delete(a.malId);
      else if (next.size < MAX_PICKS_RECOMMENDED) {
        next.set(a.malId, {
          malId: a.malId,
          title: a.english ?? a.romaji,
          coverImageURL: a.coverImageURL,
        });
      }
      return next;
    });
  };

  const selectedIds = useMemo(() => new Set(picks.keys()), [picks]);

  const finish = (patch: Partial<UserProfile>) => {
    onComplete({
      ...loadProfile(),
      onboardingComplete: true,
      favoriteAnime: [...picks.values()],
      jlptGoal: jlpt,
      preferredStreamMode: mode,
      kanaBaselineDone: kanaResult === "pass",
      ...patch,
    });
  };

  return (
    <div className="ip-root ip-onboarding">
      <div className="ip-onboarding-wrap">
        <header className="ip-header">
          <div>
            <div className="ip-eyebrow">JoyLingo · welcome</div>
            <h1 className="ip-title">Learn Japanese from anime you love</h1>
          </div>
        </header>

        <Stepper step={step} />

        <div className="ip-onboarding-panel">
          {step === "welcome" && (
            <section>
              <p className="ip-onboarding-pitch">
                Pick a few anime you enjoy, set an optional JLPT goal, and JoyLingo
                builds a hybrid path: kana basics → immersion episodes → mine words
                you hear → review with spaced repetition.
              </p>
              <div className="ip-onboarding-actions">
                <button className="btn-primary" onClick={() => setStep("anime")}>
                  Get started
                </button>
                <button className="kana-link" onClick={() => setStep("jlpt")}>
                  I already have a profile saved — skip ahead
                </button>
              </div>
            </section>
          )}

          {step === "anime" && (
            <section>
              <div className="ip-section-label">Pick 3–5 anime</div>
              <p className="ip-paste-hint">
                We&apos;ll surface episodes for these on your home feed.
              </p>
              <AnimeSearchPicker
                selected={selectedIds}
                onToggle={togglePick}
                max={MAX_PICKS_RECOMMENDED}
                initialQuery="One Piece"
                searchOnMount
              />
              <div className="ip-onboarding-actions">
                <button
                  className="btn-primary"
                  disabled={picks.size < MIN_PICKS}
                  onClick={() => setStep("jlpt")}
                >
                  Continue {picks.size >= MIN_PICKS ? `(${picks.size})` : ""}
                </button>
                {picks.size > 0 && picks.size < MIN_PICKS && (
                  <span className="ip-paste-hint">Pick at least {MIN_PICKS} to continue.</span>
                )}
              </div>
            </section>
          )}

          {step === "jlpt" && (
            <section>
              <div className="ip-section-label">Optional JLPT goal</div>
              <p className="ip-paste-hint">
                JoyLingo prioritizes immersion either way; a goal helps sort kanji later.
              </p>
              <div className="ip-onboarding-jlpt">
                {JLPT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className={"ip-onboarding-goal" + (jlpt === o.id ? " sel" : "")}
                    onClick={() => setJlpt(o.id)}
                  >
                    <span className="ip-onboarding-goal-label">{o.label}</span>
                    <span className="ip-onboarding-goal-hint">{o.hint}</span>
                  </button>
                ))}
              </div>
              <div className="ip-onboarding-mode">
                <span className="ip-section-label">Preferred stream mode</span>
                <div className="ip-anime-mode">
                  <button className={"tool" + (mode === "sub" ? " on" : "")} onClick={() => setMode("sub")}>
                    Sub
                  </button>
                  <button className={"tool" + (mode === "dub" ? " on" : "")} onClick={() => setMode("dub")}>
                    Dub
                  </button>
                </div>
              </div>
              <div className="ip-onboarding-actions">
                <button className="kana-link" onClick={() => setStep("anime")}>← back</button>
                <button className="btn-primary" onClick={() => setStep("kana")}>Continue</button>
              </div>
            </section>
          )}

          {step === "kana" && (
            <section>
              <div className="ip-section-label">Quick kana check (optional)</div>
              <KanaCheck onResult={(r) => setKanaResult(r)} result={kanaResult} />
              <div className="ip-onboarding-actions">
                <button className="kana-link" onClick={() => setStep("jlpt")}>← back</button>
                <button className="kana-link" onClick={() => setKanaResult("pass")}>
                  Skip — I know kana
                </button>
                <button className="btn-primary" onClick={() => setStep("done")}>Continue</button>
              </div>
            </section>
          )}

          {step === "done" && (
            <section>
              <div className="ip-section-label">All set!</div>
              <p className="ip-onboarding-pitch">
                {picks.size} anime picked · {jlpt ? `goal: ${jlpt}` : "no JLPT goal"} ·{" "}
                {kanaResult === "pass" ? "kana baseline marked" : "kana added to your path"}.
              </p>
              <div className="ip-onboarding-actions">
                <button className="btn-primary" onClick={() => finish({})}>
                  Start learning
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: StepId }) {
  const order: StepId[] = ["welcome", "anime", "jlpt", "kana", "done"];
  const idx = order.indexOf(step);
  return (
    <div className="ip-onboarding-stepper" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={order.length}>
      {order.map((s, i) => (
        <span
          key={s}
          className={"ip-onboarding-dot" + (i === idx ? " on" : i < idx ? " done" : "")}
          title={STEP_LABELS[s]}
        />
      ))}
    </div>
  );
}

function KanaCheck({
  result,
  onResult,
}: {
  result: "pass" | "fail" | null;
  onResult: (r: "pass" | "fail") => void;
}) {
  const prompts = useMemo(() => shuffle(KANA_PROMPTS).slice(0, 5), []);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const current = prompts[idx];

  if (result !== null) {
    return (
      <div className="ip-onboarding-kana-result">
        {result === "pass"
          ? "Looks like you know the basics — your kana step will be marked done."
          : "No worries — JoyLingo will queue the kana basics step in your learning path."}
      </div>
    );
  }

  if (!current) return null;

  const submit = () => {
    const ok = input.trim().toLowerCase() === current.romaji;
    const nextScore = score + (ok ? 1 : 0);
    if (idx + 1 >= prompts.length) {
      onResult(nextScore / prompts.length >= PASS_THRESHOLD ? "pass" : "fail");
      return;
    }
    setScore(nextScore);
    setIdx((i) => i + 1);
    setInput("");
  };

  return (
    <div className="ip-onboarding-kana">
      <div className="kana-quiz-prompt" lang="ja">{current.char}</div>
      <form
        className="kana-quiz-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          autoFocus
          value={input}
          placeholder="type romaji (e.g. ka)"
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-primary" disabled={!input.trim()}>
          {idx + 1 < prompts.length ? "Next" : "Finish"}
        </button>
      </form>
      <div className="ip-paste-hint">
        Prompt {idx + 1} of {prompts.length} · ≥80% to mark kana done.
      </div>
    </div>
  );
}
