#!/usr/bin/env tsx
/**
 * Build packages/web/public/curriculum/vocab-index.json from markdown tables.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildVocabIndex } from "../src/curriculum/parse-markdown.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const curriculumDir = path.join(root, "packages/web/public/curriculum");
const outPath = path.join(curriculumDir, "vocab-index.json");

const words = await buildVocabIndex({ curriculumDir });
await writeFile(outPath, JSON.stringify(words, null, 2) + "\n", "utf8");
console.log(`Wrote ${words.length} curriculum words to ${outPath}`);
