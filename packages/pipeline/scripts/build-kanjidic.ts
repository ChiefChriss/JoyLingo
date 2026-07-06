/**
 * Download KANJIDIC2 and build a compact JSON reference for the web client.
 *
 *   npm run build-kanjidic
 *
 * Writes:
 *   packages/pipeline/data/kanjidic.json
 *   packages/web/public/kanji/reference.json
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KanjiReference } from "@joylingo/shared";

const PIPELINE_DATA = fileURLToPath(new URL("../data/", import.meta.url));
const WEB_PUBLIC = fileURLToPath(
  new URL("../../web/public/kanji/", import.meta.url),
);

const KANJIDIC_URLS = [
  "https://raw.githubusercontent.com/martinlindhe/kanjidic/master/kanjidic2.xml",
  "http://ftp.monash.edu.au/pub/nihongo/kanjidic2.xml",
];

/** Fallback when download fails — common kanji from early episodes + joyo sample. */
const SEED: KanjiReference[] = [
  { char: "電", meanings: ["electricity"], onReadings: ["デン"], kunReadings: [], jlpt: 5, grade: 2, strokeCount: 13 },
  { char: "車", meanings: ["car", "wheel"], onReadings: ["シャ"], kunReadings: ["くるま"], jlpt: 5, grade: 1, strokeCount: 7 },
  { char: "来", meanings: ["come"], onReadings: ["ライ"], kunReadings: ["く.る", "きた"], jlpt: 5, grade: 2, strokeCount: 7 },
  { char: "駅", meanings: ["station"], onReadings: ["エキ"], kunReadings: [], jlpt: 4, grade: 3, strokeCount: 14 },
  { char: "朝", meanings: ["morning"], onReadings: ["チョウ"], kunReadings: ["あさ"], jlpt: 5, grade: 2, strokeCount: 12 },
  { char: "食", meanings: ["eat", "food"], onReadings: ["ショク", "ジキ"], kunReadings: ["た.べる", "く.う"], jlpt: 5, grade: 2, strokeCount: 9 },
  { char: "行", meanings: ["go", "conduct"], onReadings: ["コウ", "ギョウ"], kunReadings: ["い.く", "ゆ.く"], jlpt: 5, grade: 2, strokeCount: 6 },
  { char: "見", meanings: ["see"], onReadings: ["ケン"], kunReadings: ["み.る", "み.える"], jlpt: 5, grade: 1, strokeCount: 7 },
  { char: "日", meanings: ["day", "sun"], onReadings: ["ニチ", "ジツ"], kunReadings: ["ひ", "か"], jlpt: 5, grade: 1, strokeCount: 4 },
  { char: "本", meanings: ["book", "origin"], onReadings: ["ホン"], kunReadings: ["もと"], jlpt: 5, grade: 1, strokeCount: 5 },
  { char: "人", meanings: ["person"], onReadings: ["ジン", "ニン"], kunReadings: ["ひと"], jlpt: 5, grade: 1, strokeCount: 2 },
  { char: "学", meanings: ["study", "learning"], onReadings: ["ガク"], kunReadings: ["まな.ぶ"], jlpt: 5, grade: 1, strokeCount: 8 },
  { char: "語", meanings: ["word", "language"], onReadings: ["ゴ"], kunReadings: ["かた.る", "かた.らう"], jlpt: 5, grade: 2, strokeCount: 14 },
  { char: "話", meanings: ["talk", "story"], onReadings: ["ワ"], kunReadings: ["はな.す", "はなし"], jlpt: 5, grade: 2, strokeCount: 13 },
  { char: "聞", meanings: ["hear", "ask"], onReadings: ["ブン", "モン"], kunReadings: ["き.く"], jlpt: 5, grade: 2, strokeCount: 14 },
  { char: "読", meanings: ["read"], onReadings: ["ドク", "トク"], kunReadings: ["よ.む"], jlpt: 5, grade: 2, strokeCount: 14 },
  { char: "書", meanings: ["write"], onReadings: ["ショ"], kunReadings: ["か.く"], jlpt: 5, grade: 2, strokeCount: 10 },
  { char: "水", meanings: ["water"], onReadings: ["スイ"], kunReadings: ["みず"], jlpt: 5, grade: 1, strokeCount: 4 },
  { char: "火", meanings: ["fire"], onReadings: ["カ"], kunReadings: ["ひ"], jlpt: 5, grade: 1, strokeCount: 4 },
  { char: "山", meanings: ["mountain"], onReadings: ["サン"], kunReadings: ["やま"], jlpt: 5, grade: 1, strokeCount: 3 },
];

async function main() {
  let entries: KanjiReference[] = SEED;
  let lastErr: unknown = null;

  for (const url of KANJIDIC_URLS) {
    try {
      console.log(`Fetching KANJIDIC2 from ${url}…`);
      const res = await fetch(url, { headers: { "User-Agent": "joylingo-pipeline" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const xml = await res.text();
      entries = parseKanjidicXml(xml);
      console.log(`  parsed ${entries.length} kanji`);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`  failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (lastErr) {
    console.warn("  all sources failed — using seed set");
  }

  const json = JSON.stringify(entries, null, 0);
  await mkdir(PIPELINE_DATA, { recursive: true });
  await mkdir(WEB_PUBLIC, { recursive: true });

  const pipelinePath = path.join(PIPELINE_DATA, "kanjidic.json");
  const webPath = path.join(WEB_PUBLIC, "reference.json");
  await writeFile(pipelinePath, json);
  await writeFile(webPath, json);
  console.log(`✓ wrote ${pipelinePath}`);
  console.log(`✓ wrote ${webPath}`);
}

function parseKanjidicXml(xml: string): KanjiReference[] {
  const entries: KanjiReference[] = [];
  const charRe = /<character>([^<]+)<\/character>/g;
  const blocks = xml.split("<character>");

  for (let i = 1; i < blocks.length; i++) {
    const block = "<character>" + blocks[i]!;
    const charM = /<literal>([^<]+)<\/literal>/.exec(block);
    if (!charM) continue;
    const char = charM[1]!;

    const meanings: string[] = [];
    for (const m of block.matchAll(/<meaning[^>]*>([^<]+)<\/meaning>/g)) {
      if (!m[1]!.includes(" ")) meanings.push(m[1]!);
    }

    const onReadings: string[] = [];
    const kunReadings: string[] = [];
    for (const r of block.matchAll(/<reading[^>]*>([^<]+)<\/reading>/g)) {
      const tag = r[0]!;
      const text = r[1]!;
      if (tag.includes('r_type="ja_on"')) onReadings.push(text);
      else if (tag.includes('r_type="ja_kun"')) kunReadings.push(text.replace(/\.+/g, "."));
    }

    const strokeM = /<stroke_count>(\d+)<\/stroke_count>/.exec(block);
    const gradeM = /<grade>(\d+)<\/grade>/.exec(block);
    const jlptM = /<jlpt>(\d+)<\/jlpt>/.exec(block);
    const freqM = /<freq>(\d+)<\/freq>/.exec(block);

    entries.push({
      char,
      meanings: meanings.slice(0, 6),
      onReadings: [...new Set(onReadings)],
      kunReadings: [...new Set(kunReadings)],
      jlpt: jlptM ? Number(jlptM[1]) : null,
      grade: gradeM ? Number(gradeM[1]) : null,
      strokeCount: strokeM ? Number(strokeM[1]) : null,
      frequencyRank: freqM ? Number(freqM[1]) : null,
    });
  }

  return entries;
}

main().catch((err) => {
  console.error("✗ build-kanjidic failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
