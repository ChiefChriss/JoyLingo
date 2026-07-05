import { readFile } from "node:fs/promises";
import type { Pos } from "@joylingo/shared";
import type { GlossProvider } from "./provider.js";
import type { JmdictFile, JmdictWord, JmdictSense } from "./jmdict-types.js";

/** How many senses / glosses to surface on the dictionary card. */
const MAX_SENSES = 2;
const MAX_GLOSSES = 4;

/**
 * Predicate matching our display POS against jmdict-simplified POS tags, used to
 * pick the right sense for a homograph (e.g. 来る verb vs a noun spelling).
 */
const POS_MATCHERS: Record<Pos, (p: string) => boolean> = {
  noun: (p) => p === "n" || p.startsWith("n-") || p === "num",
  pronoun: (p) => p === "pn",
  verb: (p) => p.startsWith("v"),
  "adj-i": (p) => p === "adj-i" || p === "adj-ix",
  "adj-na": (p) => p === "adj-na" || p === "adj-no" || p === "adj-t" || p === "adj-f",
  adv: (p) => p === "adv" || p === "adv-to",
  particle: (p) => p === "prt",
  auxiliary: (p) => p === "aux" || p === "aux-v" || p === "aux-adj",
  copula: (p) => p === "cop" || p === "cop-da",
  conj: (p) => p === "conj",
  interj: (p) => p === "int",
  prefix: (p) => p === "pref",
  suffix: (p) => p === "suf" || p === "ctr",
  counter: (p) => p === "ctr",
  expr: (p) => p === "exp",
  unknown: () => true,
};

/**
 * In-memory JMdict gloss provider. Indexes every kanji and kana spelling of
 * each entry so lookups by dictionary form are O(1).
 */
export class JmdictGlossProvider implements GlossProvider {
  readonly id: string;
  private readonly index: Map<string, JmdictWord[]>;

  private constructor(id: string, index: Map<string, JmdictWord[]>) {
    this.id = id;
    this.index = index;
  }

  static fromFile(file: JmdictFile): JmdictGlossProvider {
    const index = new Map<string, JmdictWord[]>();
    const add = (key: string, word: JmdictWord) => {
      const bucket = index.get(key);
      if (bucket) bucket.push(word);
      else index.set(key, [word]);
    };
    for (const word of file.words) {
      for (const k of word.kanji) add(k.text, word);
      for (const k of word.kana) add(k.text, word);
    }
    return new JmdictGlossProvider(`jmdict-simplified@${file.version}`, index);
  }

  static async load(path: string): Promise<JmdictGlossProvider> {
    const raw = await readFile(path, "utf8");
    const file = JSON.parse(raw) as JmdictFile;
    return JmdictGlossProvider.fromFile(file);
  }

  lookup(dict: string, pos: Pos): string | null {
    const words = this.index.get(dict);
    if (!words || words.length === 0) return null;

    const match = POS_MATCHERS[pos] ?? POS_MATCHERS.unknown;

    // Prefer senses whose POS matches; if a whole entry matches, prefer it.
    const posMatches = (s: JmdictSense) => s.partOfSpeech.some(match);
    const ranked = [...words].sort(
      (a, b) => Number(b.sense.some(posMatches)) - Number(a.sense.some(posMatches))
    );

    for (const word of ranked) {
      const senses = word.sense.filter(posMatches);
      const gloss = joinGlosses(senses.length > 0 ? senses : word.sense);
      if (gloss) return gloss;
    }
    return null;
  }
}

function joinGlosses(senses: JmdictSense[]): string | null {
  const parts: string[] = [];
  for (const sense of senses.slice(0, MAX_SENSES)) {
    for (const g of sense.gloss) {
      if (g.lang === "eng" && g.text) parts.push(g.text);
      if (parts.length >= MAX_GLOSSES) break;
    }
    if (parts.length >= MAX_GLOSSES) break;
  }
  return parts.length > 0 ? parts.join("; ") : null;
}
