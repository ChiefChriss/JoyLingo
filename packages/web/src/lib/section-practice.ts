/**
 * Build practice sets for EDU short-lesson gates:
 * authored JSON fences, kana generators, vocab generators, practice seeds.
 */
import type {
  CurriculumWord,
  EduLessonId,
  EduSection,
  EduSectionId,
  PracticeItem,
  PracticeSet,
} from "@joylingo/shared";
import {
  bindPracticeToSections,
  parsePracticeFences,
  parseSectionsFromMarkdown,
} from "@joylingo/shared";
import { allKana, type KanaScript, shuffle } from "./kana";
import { findPracticeSeed } from "./practice-seeds";
import { buildStagedPracticeSet } from "./staged-practice";
import { SCHOOL_PASS_SCORE } from "@joylingo/shared";

const DEFAULT_PASS = SCHOOL_PASS_SCORE;
const MIN_ITEMS = 5;
const MAX_ITEMS = 10;

export interface ParsedLessonContent {
  sections: EduSection[];
  authored: Map<EduSectionId, PracticeSet>;
}

export function parseLessonContent(
  md: string,
  lessonId: EduLessonId,
): ParsedLessonContent {
  const sections = parseSectionsFromMarkdown(md, lessonId);
  const fences = parsePracticeFences(md);
  const authored = bindPracticeToSections(sections, fences);
  return { sections, authored };
}

function pickDistractors(correct: string, pool: string[], n: number): string[] {
  const others = shuffle(pool.filter((x) => x !== correct));
  return others.slice(0, n);
}

function kanaItemsForProfile(
  profile: { script: KanaScript; stages?: number[]; groups?: string[]; mix?: boolean },
  sectionId: EduSectionId,
): PracticeItem[] {
  let pool = allKana(profile.script);
  if (profile.stages) {
    const set = new Set(profile.stages);
    pool = pool.filter((k) => set.has(k.stage));
  }
  if (profile.groups) {
    const set = new Set(profile.groups);
    pool = pool.filter((k) => set.has(k.groupId));
  }
  if (pool.length === 0) pool = allKana(profile.script);

  const selected = shuffle(pool).slice(
    0,
    Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, pool.length)),
  );
  const charPool = pool.map((k) => k.char);
  const items: PracticeItem[] = [];

  selected.forEach((k, i) => {
    if (i % 2 === 0) {
      items.push({
        id: `${sectionId}-read-${k.char}-${i}`,
        type: "reading",
        prompt: `What is the romaji for ${k.char}?`,
        answer: k.romaji,
        accept: [k.romaji.toUpperCase()],
        hint: "Type the Hepburn romaji.",
        explain: `${k.char} = ${k.romaji}`,
      });
    } else {
      const choices = shuffle([k.char, ...pickDistractors(k.char, charPool, 3)]);
      items.push({
        id: `${sectionId}-choice-${k.char}-${i}`,
        type: "choice",
        prompt: `Which character is “${k.romaji}”?`,
        answer: k.char,
        choices,
        explain: `${k.romaji} → ${k.char}`,
      });
    }
  });

  while (items.length < MIN_ITEMS && pool.length > 0) {
    const k = pool[items.length % pool.length]!;
    items.push({
      id: `${sectionId}-extra-${k.char}-${items.length}`,
      type: "produce",
      prompt: `Type the romaji for ${k.char}`,
      answer: k.romaji,
      explain: `${k.char} = ${k.romaji}`,
    });
  }

  if (profile.mix) {
    const kata = shuffle(allKana("katakana").filter((k) => k.stage <= 3)).slice(0, 3);
    const kataChars = allKana("katakana").map((c) => c.char);
    for (const k of kata) {
      items.push({
        id: `${sectionId}-kata-${k.char}`,
        type: "choice",
        prompt: `Katakana for “${k.romaji}”?`,
        answer: k.char,
        choices: shuffle([k.char, ...pickDistractors(k.char, kataChars, 3)]),
      });
    }
  }

  return shuffle(items).slice(0, MAX_ITEMS);
}

function vocabItemsForSection(
  words: CurriculumWord[],
  sectionId: EduSectionId,
): PracticeItem[] {
  if (words.length === 0) return [];
  const pool = shuffle(words).slice(0, Math.min(MAX_ITEMS, words.length));
  const glosses = words.map((w) => w.gloss).filter(Boolean);
  const surfaces = words.map((w) => w.surface);
  const items: PracticeItem[] = [];

  pool.forEach((w, i) => {
    if (i % 3 === 0) {
      items.push({
        id: `${sectionId}-vg-${w.id}`,
        type: "choice",
        prompt: `What does 「${w.surface}」(${w.reading}) mean?`,
        answer: w.gloss,
        choices: shuffle([w.gloss, ...pickDistractors(w.gloss, glosses, 3)]),
        explain: `${w.surface} (${w.reading}) — ${w.gloss}`,
      });
    } else if (i % 3 === 1) {
      items.push({
        id: `${sectionId}-vs-${w.id}`,
        type: "choice",
        prompt: `Which word means “${w.gloss}”?`,
        answer: w.surface,
        choices: shuffle([w.surface, ...pickDistractors(w.surface, surfaces, 3)]),
        explain: `${w.gloss} → ${w.surface} (${w.reading})`,
      });
    } else {
      items.push({
        id: `${sectionId}-vr-${w.id}`,
        type: "reading",
        prompt: `Reading for 「${w.surface}」? (hiragana)`,
        answer: w.reading,
        accept: [w.reading.replace(/\s/g, "")],
        explain: `${w.surface} = ${w.reading} — ${w.gloss}`,
      });
    }
  });

  while (items.length < MIN_ITEMS && words.length > 0) {
    const w = words[items.length % words.length]!;
    items.push({
      id: `${sectionId}-vfill-${w.id}-${items.length}`,
      type: "choice",
      prompt: `「${w.surface}」 means…`,
      answer: w.gloss,
      choices: shuffle([w.gloss, ...pickDistractors(w.gloss, glosses, 3)]),
    });
  }

  return shuffle(items).slice(0, MAX_ITEMS);
}

function mixedReviewItems(
  sectionId: EduSectionId,
  priorSets: PracticeSet[],
): PracticeItem[] {
  const pool = priorSets.flatMap((s) => s.items);
  if (pool.length === 0) return [];
  return shuffle(pool)
    .slice(0, MAX_ITEMS)
    .map((it, i) => ({ ...it, id: `${sectionId}-mix-${i}-${it.id}` }));
}

function padWithDuplicates(items: PracticeItem[], sectionId: EduSectionId): PracticeItem[] {
  const out = [...items];
  let i = 0;
  while (out.length < MIN_ITEMS && items.length > 0) {
    const src = items[i % items.length]!;
    out.push({ ...src, id: `${sectionId}-pad-${out.length}-${src.id}` });
    i++;
  }
  return out;
}

export interface ResolvePracticeOpts {
  lessonId: EduLessonId;
  section: EduSection;
  sections: EduSection[];
  authored: Map<EduSectionId, PracticeSet>;
  vocabWords?: CurriculumWord[];
  priorSets?: PracticeSet[];
}

/**
 * Resolve the practice set for one section.
 * Prefer: fence → seeds → lesson-type generators → mixed prior → never empty if possible.
 */
export function resolvePracticeSet(opts: ResolvePracticeOpts): PracticeSet {
  const { section, authored, lessonId, vocabWords = [], priorSets = [] } = opts;
  const passScore = DEFAULT_PASS;

  const stageWrap = (kind: PracticeSet["kind"], items: PracticeItem[]) =>
    buildStagedPracticeSet(section.id, section.title, items, kind);

  const fromFence = authored.get(section.id);
  if (fromFence && fromFence.items.length > 0) {
    return stageWrap(fromFence.kind, fromFence.items);
  }

  const seed = findPracticeSeed(section.id, section.title);
  if (seed && seed.length > 0) {
    const kind =
      lessonId === "03" || lessonId === "05"
        ? "vocab"
        : lessonId === "01"
          ? "kana"
          : "grammar";
    return stageWrap(kind, seed);
  }

  if (lessonId === "01") {
    let items: PracticeItem[];
    if (/katakana|カタカナ/i.test(section.title) || /katakana/i.test(section.slug)) {
      items = kanaItemsForProfile({ script: "katakana", stages: [1, 2, 3, 4] }, section.id);
    } else if (/hiragana|ひらがな/i.test(section.title) || /hiragana/i.test(section.slug)) {
      items = kanaItemsForProfile({ script: "hiragana", stages: [1, 2, 3, 4] }, section.id);
    } else if (/self-check|self check|can you/i.test(section.title)) {
      items = kanaItemsForProfile(
        { script: "hiragana", stages: [1, 2, 3, 4, 5], mix: true },
        section.id,
      );
    } else if (/stroke/i.test(section.title)) {
      items = kanaItemsForProfile({ script: "hiragana", stages: [1, 2, 3] }, section.id);
    } else if (/pronunciation/i.test(section.title)) {
      items = kanaItemsForProfile({ script: "hiragana", stages: [1] }, section.id);
    } else {
      items = kanaItemsForProfile({ script: "hiragana", stages: [1, 2] }, section.id);
    }
    return stageWrap("kana", items);
  }

  // Vocab mega-lessons: prefer live vocab index when available
  if (lessonId === "03" || lessonId === "05") {
    if (vocabWords.length > 0) {
      if (section.kind === "self_check" || section.kind === "summary") {
        const mixed = mixedReviewItems(section.id, priorSets);
        if (mixed.length > 0) {
          return stageWrap("mixed", padWithDuplicates(mixed, section.id));
        }
      }
      if (
        /vocab|vocabulary|kanji|adverb|conversation|expression/i.test(
          section.title + section.slug,
        )
      ) {
        const items = vocabItemsForSection(vocabWords, section.id);
        if (items.length > 0) {
          return stageWrap("vocab", items);
        }
      }
    }
    // Fallback seed bank when index empty / section has no tables
    const fb = findPracticeSeed(section.id, section.title);
    if (fb && fb.length > 0) return stageWrap("vocab", fb);
    // Last resort: generic N5-ish drills so stage never shows "Soon"
    return stageWrap("vocab", [
      {
        id: `${section.id}-g1`,
        type: "choice",
        prompt: "What does がっこう mean?",
        answer: "school",
        choices: ["school", "book", "water", "train"],
      },
      {
        id: `${section.id}-g2`,
        type: "choice",
        prompt: "What does たべる mean?",
        answer: "to eat",
        choices: ["to eat", "to go", "to see", "to buy"],
      },
      {
        id: `${section.id}-g3`,
        type: "produce",
        prompt: 'Type Japanese for "I am a student." (polite)',
        answer: "わたしはがくせいです",
        accept: ["わたしは がくせいです", "私は学生です"],
      },
      {
        id: `${section.id}-g4`,
        type: "reading",
        prompt: "Reading for 本?",
        answer: "ほん",
      },
      {
        id: `${section.id}-g5`,
        type: "choice",
        prompt: "みず means…",
        answer: "water",
        choices: ["water", "fire", "mountain", "car"],
      },
      {
        id: `${section.id}-g6`,
        type: "produce",
        prompt: "Type the reading for がくせい",
        answer: "がくせい",
      },
    ]);
  }

  if (section.kind === "self_check" || section.kind === "summary") {
    const mixed = mixedReviewItems(section.id, priorSets);
    if (mixed.length > 0) {
      return stageWrap("mixed", padWithDuplicates(mixed, section.id));
    }
  }

  if (priorSets.length > 0) {
    const mixed = mixedReviewItems(section.id, priorSets);
    if (mixed.length > 0) {
      return stageWrap("mixed", padWithDuplicates(mixed, section.id));
    }
  }

  return {
    sectionId: section.id,
    kind: "general",
    passScore,
    items: [],
    staged: {},
  };
}

/** Resolve practice for all sections in order (fills priorSets for cumulative quizzes). */
export function resolveAllPracticeSets(
  lessonId: EduLessonId,
  sections: EduSection[],
  authored: Map<EduSectionId, PracticeSet>,
  vocabWords: CurriculumWord[] = [],
): Map<EduSectionId, PracticeSet> {
  const map = new Map<EduSectionId, PracticeSet>();
  const prior: PracticeSet[] = [];
  for (const section of sections) {
    const set = resolvePracticeSet({
      lessonId,
      section,
      sections,
      authored,
      vocabWords,
      priorSets: prior,
    });
    map.set(section.id, set);
    if (set.items.length > 0) {
      prior.push(set);
    }
  }
  return map;
}
