/** Hiragana & katakana — gojūon rows, dakuten, handakuten, yōon. */

export type KanaScript = "hiragana" | "katakana";

export interface KanaChar {
  /** Character in the active script */
  char: string;
  /** Hepburn romaji (lowercase) */
  romaji: string;
  /** Row id for grouping / quiz filters */
  groupId: string;
  /** Learning stage (1 = basics → 5 = yōon) */
  stage: number;
}

export interface KanaGroup {
  id: string;
  label: string;
  labelJa: string;
  stage: number;
}

export interface KanaRow {
  /** Row header romaji, e.g. "k" */
  head: string;
  /** Group id for quiz row toggles */
  groupId: string;
  /** Five slots (a i u e o); null = empty cell in chart */
  cells: (KanaChar | null)[];
}

const GROUPS: KanaGroup[] = [
  { id: "vowels", label: "Vowels", labelJa: "あ行", stage: 1 },
  { id: "k", label: "K-row", labelJa: "か行", stage: 1 },
  { id: "s", label: "S-row", labelJa: "さ行", stage: 1 },
  { id: "t", label: "T-row", labelJa: "た行", stage: 1 },
  { id: "n", label: "N-row", labelJa: "な行", stage: 2 },
  { id: "h", label: "H-row", labelJa: "は行", stage: 2 },
  { id: "m", label: "M-row", labelJa: "ま行", stage: 2 },
  { id: "y", label: "Y-row", labelJa: "や行", stage: 3 },
  { id: "r", label: "R-row", labelJa: "ら行", stage: 3 },
  { id: "w", label: "W-row", labelJa: "わ行", stage: 3 },
  { id: "nn", label: "N", labelJa: "ん", stage: 3 },
  { id: "g", label: "G-row", labelJa: "が行", stage: 4 },
  { id: "z", label: "Z-row", labelJa: "ざ行", stage: 4 },
  { id: "d", label: "D-row", labelJa: "だ行", stage: 4 },
  { id: "b", label: "B-row", labelJa: "ば行", stage: 4 },
  { id: "p", label: "P-row", labelJa: "ぱ行", stage: 4 },
  { id: "ky", label: "Ky", labelJa: "きゃ行", stage: 5 },
  { id: "sh", label: "Sh", labelJa: "しゃ行", stage: 5 },
  { id: "ch", label: "Ch", labelJa: "ちゃ行", stage: 5 },
  { id: "ny", label: "Ny", labelJa: "にゃ行", stage: 5 },
  { id: "hy", label: "Hy", labelJa: "ひゃ行", stage: 5 },
  { id: "my", label: "My", labelJa: "みゃ行", stage: 5 },
  { id: "ry", label: "Ry", labelJa: "りゃ行", stage: 5 },
  { id: "gy", label: "Gy", labelJa: "ぎゃ行", stage: 5 },
  { id: "jy", label: "J", labelJa: "じゃ行", stage: 5 },
  { id: "by", label: "By", labelJa: "びゃ行", stage: 5 },
  { id: "py", label: "Py", labelJa: "ぴゃ行", stage: 5 },
];

/** Pairs: [hiragana, katakana, romaji, groupId, stage] */
type Raw = [string, string, string, string, number];

const RAW: Raw[] = [
  // vowels
  ["あ", "ア", "a", "vowels", 1],
  ["い", "イ", "i", "vowels", 1],
  ["う", "ウ", "u", "vowels", 1],
  ["え", "エ", "e", "vowels", 1],
  ["お", "オ", "o", "vowels", 1],
  // k
  ["か", "カ", "ka", "k", 1],
  ["き", "キ", "ki", "k", 1],
  ["く", "ク", "ku", "k", 1],
  ["け", "ケ", "ke", "k", 1],
  ["こ", "コ", "ko", "k", 1],
  // s
  ["さ", "サ", "sa", "s", 1],
  ["し", "シ", "shi", "s", 1],
  ["す", "ス", "su", "s", 1],
  ["せ", "セ", "se", "s", 1],
  ["そ", "ソ", "so", "s", 1],
  // t
  ["た", "タ", "ta", "t", 1],
  ["ち", "チ", "chi", "t", 1],
  ["つ", "ツ", "tsu", "t", 1],
  ["て", "テ", "te", "t", 1],
  ["と", "ト", "to", "t", 1],
  // n
  ["な", "ナ", "na", "n", 2],
  ["に", "ニ", "ni", "n", 2],
  ["ぬ", "ヌ", "nu", "n", 2],
  ["ね", "ネ", "ne", "n", 2],
  ["の", "ノ", "no", "n", 2],
  // h
  ["は", "ハ", "ha", "h", 2],
  ["ひ", "ヒ", "hi", "h", 2],
  ["ふ", "フ", "fu", "h", 2],
  ["へ", "ヘ", "he", "h", 2],
  ["ほ", "ホ", "ho", "h", 2],
  // m
  ["ま", "マ", "ma", "m", 2],
  ["み", "ミ", "mi", "m", 2],
  ["む", "ム", "mu", "m", 2],
  ["め", "メ", "me", "m", 2],
  ["も", "モ", "mo", "m", 2],
  // y (chart: a-column, u-column, o-column only)
  ["や", "ヤ", "ya", "y", 3],
  ["ゆ", "ユ", "yu", "y", 3],
  ["よ", "ヨ", "yo", "y", 3],
  // r
  ["ら", "ラ", "ra", "r", 3],
  ["り", "リ", "ri", "r", 3],
  ["る", "ル", "ru", "r", 3],
  ["れ", "レ", "re", "r", 3],
  ["ろ", "ロ", "ro", "r", 3],
  // w
  ["わ", "ワ", "wa", "w", 3],
  ["を", "ヲ", "wo", "w", 3],
  // ん
  ["ん", "ン", "n", "nn", 3],
  // g
  ["が", "ガ", "ga", "g", 4],
  ["ぎ", "ギ", "gi", "g", 4],
  ["ぐ", "グ", "gu", "g", 4],
  ["げ", "ゲ", "ge", "g", 4],
  ["ご", "ゴ", "go", "g", 4],
  // z
  ["ざ", "ザ", "za", "z", 4],
  ["じ", "ジ", "ji", "z", 4],
  ["ず", "ズ", "zu", "z", 4],
  ["ぜ", "ゼ", "ze", "z", 4],
  ["ぞ", "ゾ", "zo", "z", 4],
  // d
  ["だ", "ダ", "da", "d", 4],
  ["ぢ", "ヂ", "di", "d", 4],
  ["づ", "ヅ", "du", "d", 4],
  ["で", "デ", "de", "d", 4],
  ["ど", "ド", "do", "d", 4],
  // b
  ["ば", "バ", "ba", "b", 4],
  ["び", "ビ", "bi", "b", 4],
  ["ぶ", "ブ", "bu", "b", 4],
  ["べ", "ベ", "be", "b", 4],
  ["ぼ", "ボ", "bo", "b", 4],
  // p
  ["ぱ", "パ", "pa", "p", 4],
  ["ぴ", "ピ", "pi", "p", 4],
  ["ぷ", "プ", "pu", "p", 4],
  ["ぺ", "ペ", "pe", "p", 4],
  ["ぽ", "ポ", "po", "p", 4],
  // yōon
  ["きゃ", "キャ", "kya", "ky", 5],
  ["きゅ", "キュ", "kyu", "ky", 5],
  ["きょ", "キョ", "kyo", "ky", 5],
  ["しゃ", "シャ", "sha", "sh", 5],
  ["しゅ", "シュ", "shu", "sh", 5],
  ["しょ", "ショ", "sho", "sh", 5],
  ["ちゃ", "チャ", "cha", "ch", 5],
  ["ちゅ", "チュ", "chu", "ch", 5],
  ["ちょ", "チョ", "cho", "ch", 5],
  ["にゃ", "ニャ", "nya", "ny", 5],
  ["にゅ", "ニュ", "nyu", "ny", 5],
  ["にょ", "ニョ", "nyo", "ny", 5],
  ["ひゃ", "ヒャ", "hya", "hy", 5],
  ["ひゅ", "ヒュ", "hyu", "hy", 5],
  ["ひょ", "ヒョ", "hyo", "hy", 5],
  ["みゃ", "ミャ", "mya", "my", 5],
  ["みゅ", "ミュ", "myu", "my", 5],
  ["みょ", "ミョ", "myo", "my", 5],
  ["りゃ", "リャ", "rya", "ry", 5],
  ["りゅ", "リュ", "ryu", "ry", 5],
  ["りょ", "リョ", "ryo", "ry", 5],
  ["ぎゃ", "ギャ", "gya", "gy", 5],
  ["ぎゅ", "ギュ", "gyu", "gy", 5],
  ["ぎょ", "ギョ", "gyo", "gy", 5],
  ["じゃ", "ジャ", "ja", "jy", 5],
  ["じゅ", "ジュ", "ju", "jy", 5],
  ["じょ", "ジョ", "jo", "jy", 5],
  ["びゃ", "ビャ", "bya", "by", 5],
  ["びゅ", "ビュ", "byu", "by", 5],
  ["びょ", "ビョ", "byo", "by", 5],
  ["ぴゃ", "ピャ", "pya", "py", 5],
  ["ぴゅ", "ピュ", "pyu", "py", 5],
  ["ぴょ", "ピョ", "pyo", "py", 5],
];

function toChar([hira, kata, romaji, groupId, stage]: Raw, script: KanaScript): KanaChar {
  return { char: script === "hiragana" ? hira : kata, romaji, groupId, stage };
}

export function allKana(script: KanaScript): KanaChar[] {
  return RAW.map((r) => toChar(r, script));
}

export function kanaGroups(): KanaGroup[] {
  return GROUPS;
}

export function kanaByGroup(script: KanaScript, groupId: string): KanaChar[] {
  return allKana(script).filter((k) => k.groupId === groupId);
}

export function kanaByStage(script: KanaScript, stages: number[]): KanaChar[] {
  const set = new Set(stages);
  return allKana(script).filter((k) => set.has(k.stage));
}

/** Traditional 5-column chart rows for display. */
export function kanaChartRows(script: KanaScript): KanaRow[] {
  const byGroup = new Map<string, KanaChar[]>();
  for (const k of allKana(script)) {
    const list = byGroup.get(k.groupId) ?? [];
    list.push(k);
    byGroup.set(k.groupId, list);
  }

  const five = (groupId: string): (KanaChar | null)[] => {
    const chars = byGroup.get(groupId) ?? [];
    if (groupId === "y") {
      const ya = chars.find((c) => c.romaji === "ya") ?? null;
      const yu = chars.find((c) => c.romaji === "yu") ?? null;
      const yo = chars.find((c) => c.romaji === "yo") ?? null;
      return [ya, null, yu, null, yo];
    }
    if (groupId === "w") {
      const wa = chars.find((c) => c.romaji === "wa") ?? null;
      const wo = chars.find((c) => c.romaji === "wo") ?? null;
      return [wa, null, null, null, wo];
    }
    if (groupId === "nn") {
      const n = chars[0] ?? null;
      return [n, null, null, null, null];
    }
    // yōon rows: ya yu yo in columns 0 2 4
    if (["ky", "sh", "ch", "ny", "hy", "my", "ry", "gy", "jy", "by", "py"].includes(groupId)) {
      const ya = chars.find((c) => c.romaji.endsWith("ya")) ?? null;
      const yu = chars.find((c) => c.romaji.endsWith("yu")) ?? null;
      const yo = chars.find((c) => c.romaji.endsWith("yo")) ?? null;
      return [ya, null, yu, null, yo];
    }
    const slots: (KanaChar | null)[] = [null, null, null, null, null];
    for (const c of chars) {
      const last = c.romaji.slice(-1);
      const idx = { a: 0, i: 1, u: 2, e: 3, o: 4 }[last];
      if (idx !== undefined) slots[idx] = c;
    }
    return slots;
  };

  return GROUPS.map((g) => ({
    head: g.labelJa,
    groupId: g.id,
    cells: five(g.id),
  }));
}

/** Accept common romaji variants (shi/si, tsu/tu, fu/hu, ji/zi, etc.) */
export function romajiMatches(input: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[-\s]/g, "")
      .replace(/oo/g, "ou")
      .replace(/uu/g, "u");

  const aliases: Record<string, string[]> = {
    shi: ["shi", "si"],
    chi: ["chi", "ti"],
    tsu: ["tsu", "tu"],
    fu: ["fu", "hu"],
    ji: ["ji", "zi", "di"],
    zu: ["zu", "du"],
    n: ["n", "nn", "xn"],
    wo: ["wo", "o"],
  };

  const a = norm(input);
  const b = norm(expected);
  if (a === b) return true;

  const alts = aliases[b];
  if (alts?.includes(a)) return true;

  // yōon without explicit y: kya vs kia
  if (b.length >= 2 && b.includes("y")) {
    const collapsed = b.replace("y", "");
    if (a === collapsed) return true;
  }

  return false;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** localStorage progress: { [char]: { correct: n, wrong: n } } */
export type KanaProgress = Record<string, { correct: number; wrong: number }>;

const progressKey = (script: KanaScript) => `joylingo:kana:${script}`;

export function loadKanaProgress(script: KanaScript): KanaProgress {
  try {
    const raw = localStorage.getItem(progressKey(script));
    return raw ? (JSON.parse(raw) as KanaProgress) : {};
  } catch {
    return {};
  }
}

export function saveKanaProgress(script: KanaScript, progress: KanaProgress): void {
  localStorage.setItem(progressKey(script), JSON.stringify(progress));
}

export function groupProgress(
  script: KanaScript,
  groupId: string,
  progress: KanaProgress,
): { pct: number; studied: number; total: number } {
  const chars = kanaByGroup(script, groupId);
  const total = chars.length;
  if (total === 0) return { pct: 0, studied: 0, total: 0 };
  let studied = 0;
  let score = 0;
  for (const c of chars) {
    const p = progress[c.char];
    if (p && p.correct + p.wrong > 0) {
      studied++;
      score += p.correct / (p.correct + p.wrong);
    }
  }
  const pct = studied === 0 ? 0 : Math.round((score / total) * 100);
  return { pct, studied, total };
}

/** Overall quiz accuracy across every character in a script. */
export function scriptOverallPct(script: KanaScript, progress: KanaProgress): number {
  const chars = allKana(script);
  if (chars.length === 0) return 0;
  let score = 0;
  let studied = 0;
  for (const c of chars) {
    const p = progress[c.char];
    if (p && p.correct + p.wrong > 0) {
      studied++;
      score += p.correct / (p.correct + p.wrong);
    }
  }
  if (studied === 0) return 0;
  return Math.round((score / chars.length) * 100);
}

/** Per-character accuracy 0–100; unseen chars return 0. */
export function charAccuracy(progress: KanaProgress, char: string): number {
  const p = progress[char];
  if (!p) return 0;
  const total = p.correct + p.wrong;
  if (total === 0) return 0;
  return Math.round((p.correct / total) * 100);
}

/** A character needs more practice: wrong ≥ correct, or accuracy below threshold. */
export function isWeakKana(progress: KanaProgress, char: string, threshold = 80): boolean {
  const p = progress[char];
  if (!p || p.correct + p.wrong === 0) return false;
  if (p.wrong >= p.correct) return true;
  return charAccuracy(progress, char) < threshold;
}

/** Characters that need extra drill, sorted by most wrong first. */
export function getWeakKana(
  script: KanaScript,
  progress: KanaProgress,
  groups?: Set<string>,
): KanaChar[] {
  return allKana(script)
    .filter((k) => (!groups || groups.has(k.groupId)) && isWeakKana(progress, k.char))
    .sort((a, b) => {
      const pa = progress[a.char] ?? { correct: 0, wrong: 0 };
      const pb = progress[b.char] ?? { correct: 0, wrong: 0 };
      return pb.wrong - pa.wrong || pa.correct - pb.correct;
    });
}

/**
 * Build a quiz queue that surfaces weak characters more often.
 * Unseen chars get moderate weight so new rows still appear.
 */
export function buildKanaQueue(
  pool: KanaChar[],
  progress: KanaProgress,
  opts?: { weakOnly?: boolean },
): KanaChar[] {
  const source = opts?.weakOnly
    ? pool.filter((k) => isWeakKana(progress, k.char))
    : pool;
  if (source.length === 0) return [];

  const weighted: KanaChar[] = [];
  for (const k of source) {
    const p = progress[k.char];
    let w = 1;
    if (!p || p.correct + p.wrong === 0) {
      w = 2; // unseen — show early
    } else if (p.wrong >= p.correct) {
      w = 4 + p.wrong; // struggling — drill hardest
    } else if (charAccuracy(progress, k.char) < 80) {
      w = 3;
    }
    for (let i = 0; i < w; i++) weighted.push(k);
  }
  return shuffle(weighted);
}

/** Re-insert a missed character a few cards ahead so it returns in the same session. */
export function requeueAfterMiss(queue: KanaChar[], char: KanaChar, afterIdx: number): KanaChar[] {
  const next = [...queue];
  const insertAt = Math.min(afterIdx + 3, next.length);
  next.splice(insertAt, 0, char);
  return next;
}
