/**
 * Mega-lesson unit exam builder + scorer (school-grade 5 blocks).
 */
import type {
  EduLessonId,
  EduSection,
  PracticeItem,
  PracticeSet,
} from "@joylingo/shared";
import {
  SCHOOL_PASS_SCORE,
  UNIT_BLOCK_FLOOR,
  UNIT_OVERALL_PASS,
} from "@joylingo/shared";
import {
  defaultUnitWritingCriteria,
  scoreWriting,
  unitWritingPrompt,
  writingPassed,
  type WritingRubricResult,
} from "./writing-rubric";

export interface UnitExamBlueprint {
  lessonId: EduLessonId;
  lessonTitle: string;
  listening: PracticeItem[];
  recognition: PracticeItem[];
  production: PracticeItem[];
  writingPrompt: string;
  writingCriteria: ReturnType<typeof defaultUnitWritingCriteria>;
  speakPrompt: string;
  speakSeconds: number;
  speakChecklist: string[];
  passScore: number;
  blockFloor: number;
  overallPass: number;
}

export function buildUnitExam(
  lessonId: EduLessonId,
  lessonTitle: string,
  sections: EduSection[],
  practiceBySection: Map<string, PracticeSet>,
): UnitExamBlueprint {
  const listening: PracticeItem[] = [];
  const recognition: PracticeItem[] = [];
  const production: PracticeItem[] = [];

  for (const s of sections) {
    const set = practiceBySection.get(s.id);
    if (!set?.staged) continue;
    for (const it of set.staged.listening ?? []) {
      if (listening.length < 5) listening.push({ ...it, id: `unit-${it.id}` });
    }
    for (const it of set.staged.checkpoint ?? []) {
      if (recognition.length < 6) recognition.push({ ...it, id: `unit-${it.id}` });
    }
    for (const it of set.staged.production ?? []) {
      if (production.length < 8) production.push({ ...it, id: `unit-${it.id}` });
    }
  }

  // pad listening
  while (listening.length < 3) {
    listening.push({
      id: `unit-listen-pad-${listening.length}`,
      type: "listen_cloze",
      stage: "listening",
      prompt: "Listen and type the Japanese.",
      promptJa: "きょうはいいてすとです。",
      answer: "きょうはいいてすとです。",
    });
  }

  return {
    lessonId,
    lessonTitle,
    listening,
    recognition,
    production,
    writingPrompt: unitWritingPrompt(lessonId, lessonTitle),
    writingCriteria: defaultUnitWritingCriteria(lessonId),
    speakPrompt: `Speak 60–90 seconds summarizing what you learned in ${lessonTitle}. Use Japanese. Cover at least two grammar or vocab points from the unit.`,
    speakSeconds: 70,
    speakChecklist: [
      "I spoke mostly or only in Japanese",
      "I covered at least two points from this mega-lesson",
      "I played back my recording",
      "I did not read only English",
    ],
    passScore: SCHOOL_PASS_SCORE,
    blockFloor: UNIT_BLOCK_FLOOR,
    overallPass: UNIT_OVERALL_PASS,
  };
}

export interface UnitExamScores {
  listening: number;
  recognition: number;
  production: number;
  writing: WritingRubricResult;
  speaking: boolean;
}

export function scoreUnitExam(scores: UnitExamScores): {
  overall: number;
  passed: boolean;
  floorsOk: boolean;
  blockScores: {
    listening: number;
    production: number;
    recognition: number;
    writing: number;
    speaking: boolean;
  };
} {
  const writingScore = scores.writing.score;
  const floorsOk =
    scores.listening >= UNIT_BLOCK_FLOOR &&
    scores.recognition >= UNIT_BLOCK_FLOOR &&
    scores.production >= UNIT_BLOCK_FLOOR &&
    writingPassed(scores.writing, 3) &&
    scores.speaking;

  // Weights: listen 25, prod 35, recog 15, write 15, speak 10
  const overall =
    scores.listening * 0.25 +
    scores.production * 0.35 +
    scores.recognition * 0.15 +
    writingScore * 0.15 +
    (scores.speaking ? 0.1 : 0);

  return {
    overall,
    floorsOk,
    passed: floorsOk && overall >= UNIT_OVERALL_PASS,
    blockScores: {
      listening: scores.listening,
      production: scores.production,
      recognition: scores.recognition,
      writing: writingScore,
      speaking: scores.speaking,
    },
  };
}

export { scoreWriting, writingPassed };
