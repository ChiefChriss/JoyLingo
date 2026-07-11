/** Deterministic writing rubric for unit exams (3/4 criteria to pass). */

export interface WritingCriterion {
  id: string;
  label: string;
  /** Return true if learner text satisfies this criterion. */
  test: (text: string) => boolean;
}

export interface WritingRubricResult {
  score: number; // 0–1
  passed: number;
  total: number;
  details: { id: string; label: string; ok: boolean }[];
}

const JA_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;

export function scoreWriting(
  text: string,
  criteria: WritingCriterion[],
  need = 3,
): WritingRubricResult {
  const details = criteria.map((c) => ({
    id: c.id,
    label: c.label,
    ok: c.test(text),
  }));
  const passed = details.filter((d) => d.ok).length;
  const total = criteria.length;
  return {
    score: total === 0 ? 0 : passed / total,
    passed,
    total,
    details,
  };
}

export function writingPassed(result: WritingRubricResult, need = 3): boolean {
  return result.passed >= need;
}

/** Default unit-exam writing criteria for a mega-lesson. */
export function defaultUnitWritingCriteria(lessonId: string): WritingCriterion[] {
  return [
    {
      id: "length",
      label: "At least 2 sentence-like units (。 or 2+ clauses) and 20+ characters",
      test: (t) => {
        const s = t.trim();
        if (s.length < 20) return false;
        const stops = (s.match(/[。．.！!？?\n]/g) ?? []).length;
        return stops >= 1 || s.length >= 40;
      },
    },
    {
      id: "japanese",
      label: "Uses Japanese script (kana/kanji), not English-only",
      test: (t) => JA_RE.test(t) && t.replace(/[a-zA-Z]/g, "").length >= 8,
    },
    {
      id: "polite_or_plain",
      label: "Includes a verb/copula ending (です/ます/だ/た/る etc.)",
      test: (t) =>
        /です|ます|でした|ました|だ[。．.\s]|だった|る[。．.\s]|た[。．.\s]|ない/.test(t),
    },
    {
      id: "lesson_signal",
      label:
        lessonId === "01"
          ? "Includes hiragana or katakana words"
          : "Includes a particle (は/が/を/に/で/と/も/の)",
      test: (t) =>
        lessonId === "01"
          ? /[\u3040-\u30ff]{2,}/.test(t)
          : /[はがをにでともへ]/.test(t),
    },
  ];
}

export function unitWritingPrompt(lessonId: string, lessonTitle: string): string {
  const prompts: Record<string, string> = {
    "01": "Write 2–3 short sentences in Japanese using only kana (and simple words). Example theme: introduce yourself.",
    "02": "Write 2–3 polite Japanese sentences using は／です and at least one other particle from Genki I (を・に・で・も).",
    "03": "Write 2–3 sentences using Genki I vocabulary (school, food, daily life). Use です/ます.",
    "04": "Write 2–3 sentences using Genki II patterns (e.g. potential, てみる, あげる/くれる, or 〜たら).",
    "05": "Write 2–3 sentences with Genki II vocab/adverbs (もう、まだ、たぶん, etc.).",
    "06": "Write 2–3 intermediate sentences using a Tobira-style connector (から/ので/のに/ても/ために).",
    "07": "Write 2–3 polite workplace-style sentences. Use です/ます and one keigo-aware choice (いらっしゃる/申す/いたします if you can).",
  };
  return (
    prompts[lessonId] ??
    `Write 2–3 Japanese sentences demonstrating what you learned in ${lessonTitle}.`
  );
}
