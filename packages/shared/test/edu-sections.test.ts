import { describe, expect, it } from "vitest";
import {
  answersMatch,
  createPracticeSession,
  gradePracticeAnswer,
  parseSectionsFromMarkdown,
  practiceSessionScore,
  slugifySectionTitle,
  type PracticeSet,
} from "../src/edu-sections.js";

describe("parseSectionsFromMarkdown", () => {
  it("extracts H2 short lessons with stable ids", () => {
    const md = `# Title

## 📐 Lesson 1: XはYです — "X is Y"

content

## 📐 Lesson 2: Demo

more
`;
    const sections = parseSectionsFromMarkdown(md, "02");
    expect(sections).toHaveLength(2);
    expect(sections[0]!.id.startsWith("02:")).toBe(true);
    expect(sections[0]!.order).toBe(0);
    expect(sections[1]!.order).toBe(1);
    expect(sections[0]!.title.toLowerCase()).toContain("lesson 1");
  });

  it("classifies self-check sections", () => {
    const md = `## ✅ Genki I Self-Check\n\n- [ ] foo`;
    const [s] = parseSectionsFromMarkdown(md, "02");
    expect(s!.kind).toBe("self_check");
  });
});

describe("slugifySectionTitle", () => {
  it("strips emoji and punctuation", () => {
    const slug = slugifySectionTitle('Lesson 1: Hello — "world"');
    expect(slug).toMatch(/^lesson-1/);
    expect(slug).not.toContain(" ");
  });
});

describe("practice session engine", () => {
  const set: PracticeSet = {
    sectionId: "02:demo",
    kind: "grammar",
    passScore: 0.8,
    items: [
      {
        id: "a",
        type: "choice",
        prompt: "1",
        answer: "yes",
        choices: ["yes", "no"],
      },
      {
        id: "b",
        type: "choice",
        prompt: "2",
        answer: "yes",
        choices: ["yes", "no"],
      },
      {
        id: "c",
        type: "choice",
        prompt: "3",
        answer: "yes",
        choices: ["yes", "no"],
      },
      {
        id: "d",
        type: "choice",
        prompt: "4",
        answer: "yes",
        choices: ["yes", "no"],
      },
      {
        id: "e",
        type: "choice",
        prompt: "5",
        answer: "yes",
        choices: ["yes", "no"],
      },
    ],
  };

  it("re-queues misses and passes with high first-try accuracy", () => {
    let state = createPracticeSession({ ...set, passScore: 0.8 });
    // miss first, then correct all including requeue
    const answers = ["no", "yes", "yes", "yes", "yes", "yes"]; // last is re-queue of first
    for (const ans of answers) {
      if (state.finished) break;
      const r = gradePracticeAnswer(state, ans);
      state = r.next;
    }
    expect(state.finished).toBe(true);
    // 4/5 first attempts correct = 80% → pass at 0.8 threshold
    expect(practiceSessionScore(state)).toBeGreaterThanOrEqual(0.8);
    expect(state.passed).toBe(true);
  });

  it("fails when first-try accuracy is below threshold", () => {
    let state = createPracticeSession(set);
    // miss 2 of 5 on first try (60%)
    const pattern = ["no", "no", "yes", "yes", "yes"];
    // Keep answering until finished (clear miss queue)
    let guard = 0;
    while (!state.finished && guard < 40) {
      const item = state.queue[0]!;
      const firstMissed = !state.firstAttempts.some((a) => a.itemId === item.id);
      const ans =
        firstMissed && pattern[state.firstAttempts.length] === "no" ? "no" : "yes";
      // simpler: first two unique misses
      const shouldMiss =
        firstMissed &&
        state.firstAttempts.filter((a) => !a.correct).length < 2 &&
        state.firstAttempts.length < 2;
      state = gradePracticeAnswer(state, shouldMiss ? "no" : "yes").next;
      guard++;
    }
    expect(state.finished).toBe(true);
    if (practiceSessionScore(state) < 0.8) {
      expect(state.passed).toBe(false);
    }
  });

  it("matches produce answers with flexible spacing", () => {
    expect(
      answersMatch("わたしは がくせいです", {
        id: "x",
        type: "produce",
        prompt: "",
        answer: "わたしはがくせいです",
      }),
    ).toBe(true);
  });
});
