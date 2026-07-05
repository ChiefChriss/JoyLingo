import { createRequire } from "node:module";
import path from "node:path";
import kuromoji from "kuromoji";
import type { IpadicFeatures, Tokenizer } from "kuromoji";
import { toHiragana } from "wanakana";
import type { Token, WordToken } from "@joylingo/shared";
import { mapPos, isSymbol } from "./pos.js";

const require = createRequire(import.meta.url);

/**
 * Matches CJK ideographs plus the iteration mark 々 (U+3005):
 *  - U+3005          iteration mark 々
 *  - U+3400–U+4DBF   CJK Unified Ext-A
 *  - U+4E00–U+9FFF   CJK Unified
 *  - U+F900–U+FAFF   CJK Compatibility Ideographs
 */
const KANJI_RE = /[々㐀-䶿一-鿿豈-﫿]/;

/**
 * A single token whose surface is entirely punctuation/symbols. kuromoji/IPADIC
 * sometimes tags standalone marks like `!` or `?` as nouns rather than 記号, so
 * we catch them here to keep them out of the deck.
 */
const PUNCT_RE = /^[\p{P}\p{S}]+$/u;

export const TOKENIZER_ID = "kuromoji@0.1.2/ipadic";

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

/**
 * Build (once) and cache the kuromoji tokenizer. Loading the IPADIC dictionary
 * is expensive, so callers share a single instance for the whole process.
 */
export function getTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (tokenizerPromise) return tokenizerPromise;

  // kuromoji's main is `<pkg>/build/kuromoji.js`; the dictionary ships at `<pkg>/dict`.
  const mainPath = require.resolve("kuromoji");
  const dicPath = path.join(path.dirname(mainPath), "..", "dict");

  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) reject(err);
      else resolve(tokenizer);
    });
  });
  return tokenizerPromise;
}

/**
 * Tokenize one line of Japanese into renderable tokens.
 *
 * IPADIC over-segments — it splits an inflected word like 来た into 来 + た, or
 * 急いで into 急い + で. We regroup a verb/adjective stem together with its
 * trailing inflectional pieces so each clickable token is a whole word carrying
 * its dictionary form (来た → one token, dict 来る). Word tokens are returned
 * with `gloss: null`; the enrichment step fills the gloss from JMdict.
 */
export function tokenizeLine(
  tokenizer: Tokenizer<IpadicFeatures>,
  text: string
): Token[] {
  const features = tokenizer.tokenize(text);
  return groupFeatures(features).map((group) => groupToToken(group));
}

/**
 * A content head is a verb or adjective — the only thing that absorbs trailing
 * inflectional pieces into a single word.
 */
function isContentHead(f: IpadicFeatures): boolean {
  return f.pos === "動詞" || f.pos === "形容詞";
}

/**
 * True for tokens that are inflectional continuations of a preceding
 * verb/adjective and should merge into it:
 *  - 助動詞 (た, ない, たい, う, ます, せる, れる, …)
 *  - 助詞-接続助詞 (the て/で/ば conjunctive particles, e.g. 急い+で)
 *  - bound/suffix verbs & adjectives (て-form auxiliaries いる/くる, ない)
 */
function isInflection(f: IpadicFeatures): boolean {
  if (f.pos === "助動詞") return true;
  if (f.pos === "助詞" && f.pos_detail_1 === "接続助詞") return true;
  if (f.pos === "動詞" && (f.pos_detail_1 === "非自立" || f.pos_detail_1 === "接尾")) return true;
  if (f.pos === "形容詞" && f.pos_detail_1 === "非自立") return true;
  return false;
}

/** Group over-segmented features into whole words. */
function groupFeatures(features: IpadicFeatures[]): IpadicFeatures[][] {
  const groups: IpadicFeatures[][] = [];
  let cur: IpadicFeatures[] = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };

  for (const f of features) {
    if (isSymbol(f)) {
      flush();
      groups.push([f]);
      continue;
    }
    const head = cur[0];
    if (head && isContentHead(head) && isInflection(f)) {
      cur.push(f);
    } else {
      flush();
      cur = [f];
    }
  }
  flush();
  return groups;
}

function groupToToken(group: IpadicFeatures[]): Token {
  const head = group[0]!;
  if (isSymbol(head) || (group.length === 1 && PUNCT_RE.test(head.surface_form))) {
    return { s: head.surface_form, punct: true };
  }

  const surface = group.map((f) => f.surface_form).join("");
  const dict = head.basic_form && head.basic_form !== "*" ? head.basic_form : surface;

  const token: WordToken = {
    s: surface,
    r: mergedReading(group, surface),
    dict,
    gloss: null,
    pos: mapPos(head),
  };
  return token;
}

/**
 * Furigana reading, in hiragana, for a (possibly merged) surface. Returns
 * `null` when the surface has no kanji, so the client can skip <ruby>. For a
 * merged word each piece's reading is concatenated (来+た → きた).
 */
function mergedReading(group: IpadicFeatures[], surface: string): string | null {
  if (!KANJI_RE.test(surface)) return null;
  return group
    .map((f) => (f.reading && f.reading !== "*" ? toHiragana(f.reading) : f.surface_form))
    .join("");
}

/**
 * Single-token reading helper (exported for tests): hiragana reading, or `null`
 * when the surface is kana-only or kuromoji had no reading.
 */
export function readingFor(surface: string, reading: string | undefined): string | null {
  if (!KANJI_RE.test(surface)) return null;
  if (!reading || reading === "*") return null;
  return toHiragana(reading);
}
