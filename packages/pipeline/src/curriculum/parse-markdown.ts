/**
 * Parse EDU curriculum markdown vocab tables into structured word entries.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { toHiragana, toRomaji } from "wanakana";
import type { EduLessonId } from "@joylingo/shared";
import type { CurriculumWord } from "@joylingo/shared";
import { getTokenizer, tokenizeLine } from "../tokenize/kuromoji.js";
import { isWord } from "@joylingo/shared";

const VOCAB_LESSONS: { lessonId: EduLessonId; file: string }[] = [
  { lessonId: "03", file: "03_genki1_vocab_kanji.md" },
  { lessonId: "05", file: "05_genki2_vocab_kanji.md" },
  // Add rows here for new vocab markdown; wire lesson pages in fusionVocabLessonId().
];

export interface ParseMarkdownOptions {
  curriculumDir: string;
}

function slugify(surface: string): string {
  return surface
    .replace(/[～〜]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "word";
}

function normalizeReading(raw: string): string {
  const trimmed = raw.trim();
  if (/^[\u3040-\u309F\u30A0-\u30FF]+$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Zāēīōūǎěǐǒǔàèìòùáéíóúäöüêô\-~]+$/.test(trimmed)) {
    return toHiragana(trimmed);
  }
  return toHiragana(toRomaji(trimmed));
}

/** Parse `| Japanese | Reading | English |` table rows from markdown. */
export function parseVocabTables(md: string, lessonId: EduLessonId): Omit<CurriculumWord, "dict">[] {
  const words: Omit<CurriculumWord, "dict">[] = [];
  let section = "general";
  const lines = md.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const heading = /^###\s+(.+)/.exec(line);
    if (heading) {
      section = slugify(heading[1]!);
      continue;
    }
    if (!line.startsWith("|")) continue;
    if (line.includes("Japanese") && line.includes("Reading")) continue;
    if (/^\|[\s-|]+\|$/.test(line)) continue;

    const cols = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cols.length < 3) continue;

    const [surface, reading, gloss] = cols;
    if (!surface || !reading || !gloss) continue;
    if (surface === "Country" || surface === "Japanese") continue;
    if (surface.startsWith("---")) continue;

    const cleanSurface = surface.replace(/[～〜]/g, "").trim();
    if (!cleanSurface || cleanSurface.length > 40) continue;

    words.push({
      id: `${lessonId}-${section}-${slugify(cleanSurface)}`,
      lessonId,
      surface: cleanSurface,
      reading: normalizeReading(reading),
      gloss: gloss.replace(/\*\*/g, "").trim(),
    });
  }

  return words;
}

async function resolveDict(surface: string, reading: string): Promise<string | null> {
  const tokenizer = await getTokenizer();
  const tokens = tokenizeLine(tokenizer, surface);
  const word = tokens.find(isWord);
  if (word) return word.dict;
  const kanaTokens = tokenizeLine(tokenizer, reading);
  const kanaWord = kanaTokens.find(isWord);
  return kanaWord?.dict ?? null;
}

/** Build the full curriculum vocab index from markdown files. */
export async function buildVocabIndex(opts: ParseMarkdownOptions): Promise<CurriculumWord[]> {
  const out: CurriculumWord[] = [];
  const seen = new Set<string>();

  for (const { lessonId, file } of VOCAB_LESSONS) {
    const md = await readFile(path.join(opts.curriculumDir, file), "utf8");
    const rows = parseVocabTables(md, lessonId);
    for (const row of rows) {
      const key = `${row.lessonId}:${row.surface}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dict = await resolveDict(row.surface, row.reading);
      out.push({ ...row, dict });
    }
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}
