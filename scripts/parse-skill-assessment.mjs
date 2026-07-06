#!/usr/bin/env node
/** One-shot parser: EDU_JAP/skill_level.md → shared skill-assessment-data.ts */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "packages/web/public/curriculum/skill_level.md"), "utf8");

const SECTION_RE = /^## [🔰🟢🟡🟠🔴🟣📖] Section ([A-G]):/m;
const sections = {
  A: { label: "Kana & Basic Sentences", jlpt: "Pre-N5", max: 8 },
  B: { label: "Particles, Verbs, Adjectives", jlpt: "N5", max: 10 },
  C: { label: "Te-form, Short Forms, Potential", jlpt: "N5/N4", max: 10 },
  D: { label: "Conditionals, Passive, Causative", jlpt: "N4", max: 10 },
  E: { label: "Advanced Grammar (Tobira)", jlpt: "N3/N2", max: 10 },
  F: { label: "Keigo", jlpt: "N3+", max: 8 },
  G: { label: "Reading Comprehension", jlpt: "Mixed", max: 6 },
};

let currentSection = "A";
let currentPassage = "";
const questions = [];

const lines = src.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  const secMatch = line.match(/^## .+ Section ([A-G]):/);
  if (secMatch) {
    currentSection = secMatch[1];
    currentPassage = "";
    continue;
  }

  if (line.startsWith("> ") && currentSection === "G" && !line.includes("Section G Score")) {
    currentPassage += (currentPassage ? "\n" : "") + line.slice(2);
    continue;
  }

  const qMatch = line.match(/^\*\*Q(\d+)\.\*\* (.+)$/);
  if (!qMatch) continue;

  const id = `q${qMatch[1]}`;
  const prompt = qMatch[2].trim();
  const options = [];
  let correct = null;

  for (let j = i + 1; j < lines.length; j++) {
    const optLine = lines[j];
    if (optLine.startsWith("**Q") || optLine.startsWith("## ") || optLine.startsWith("> **Section")) break;
    const optMatch = optLine.match(/^- ([a-d])\) (.+)$/);
    if (!optMatch) continue;
    let text = optMatch[2].trim();
    const isCorrect = text.includes("✓");
    text = text.replace(/\s*✓.*$/, "").trim();
    options.push({ id: optMatch[1], text });
    if (isCorrect) correct = optMatch[1];
  }

  if (options.length && correct) {
    questions.push({
      id,
      section: currentSection,
      prompt,
      options,
      correct,
      ...(currentPassage && questions.filter((q) => q.section === "G" && q.passage === currentPassage).length === 0
        ? { passage: currentPassage }
        : questions.some((q) => q.section === "G" && q.passage === currentPassage)
          ? {}
          : currentPassage
            ? { passage: currentPassage }
            : {}),
    });
    // attach passage to all G questions in same block
    if (currentPassage) {
      const last = questions[questions.length - 1];
      if (!last.passage) last.passage = currentPassage;
    }
  }
}

// Fix G section passages — assign passage per reading block
const gBlocks = [];
let block = "";
let inG = false;
for (const line of lines) {
  if (line.match(/^## .+ Section G:/)) { inG = true; continue; }
  if (inG && line.startsWith("## ")) break;
  if (inG && line.startsWith("**Read and answer")) { if (block) gBlocks.push(block.trim()); block = ""; continue; }
  if (inG && line.startsWith("> ") && !line.includes("Section G Score")) {
    block += (block ? "\n" : "") + line.slice(2);
  }
}
if (block) gBlocks.push(block.trim());

for (const q of questions) {
  if (q.section !== "G") continue;
  const n = parseInt(q.id.slice(1), 10);
  q.passage = n <= 59 ? gBlocks[0] ?? "" : gBlocks[1] ?? "";
}

const out = `/** Auto-generated from skill_level.md — do not edit by hand. */
import type { SkillQuestion, SkillSectionMeta } from "./skill-assessment.js";

export const SKILL_SECTIONS: Record<string, SkillSectionMeta> = ${JSON.stringify(sections, null, 2)};

export const SKILL_QUESTIONS: SkillQuestion[] = ${JSON.stringify(questions, null, 2)};
`;

writeFileSync(join(root, "packages/shared/src/skill-assessment-data.ts"), out);
console.log(`Wrote ${questions.length} questions`);
