/**
 * Strict kana handwriting grading (client-side, not OCR).
 *
 * Pipeline:
 *  1. Hard gate: stroke count must match the reference (when known)
 *  2. Shape score: user ink vs font-rendered glyph silhouette (coverage + precision)
 *  3. Optional: per-stroke DTW vs hand templates when present
 *
 * Pass only when gates + shape threshold clear — designed to reject sloppy scribbles.
 */

export type Point = { x: number; y: number };
export type Stroke = Point[];

export interface KanaStrokeTemplate {
  char: string;
  strokes: Stroke[];
}

export interface GradeOptions {
  /** Minimum combined shape score 0–1. Default 0.78 (strict). */
  minShapeScore?: number;
  /** Minimum fraction of glyph covered by user ink. Default 0.72. */
  minCoverage?: number;
  /** Minimum fraction of user ink near the glyph (anti-scribble). Default 0.70. */
  minPrecision?: number;
  /** Require exact stroke count when known. Default true. */
  requireStrokeCount?: boolean;
  /** When a stroke template exists, also require stroke DTW score. Default true. */
  requireStrokeTemplate?: boolean;
  /** Min per-stroke average DTW similarity 0–1. Default 0.62. */
  minStrokeScore?: number;
}

export interface GradeResult {
  pass: boolean;
  shapeScore: number;
  coverage: number;
  precision: number;
  strokeScore: number | null;
  expectedStrokes: number | null;
  actualStrokes: number;
  reasons: string[];
}

const GRID = 64;
/** Max distance (in grid cells) counting as “near” for coverage/precision. */
const NEAR = 3.2;

/**
 * Standard stroke counts for hiragana / katakana (textbook forms).
 * き/サ etc. use common modern counts taught in genki-style materials.
 */
const STROKE_COUNTS: Record<string, number> = {
  // hiragana
  あ: 3, い: 2, う: 2, え: 2, お: 3,
  か: 3, き: 3, く: 1, け: 3, こ: 2,
  さ: 3, し: 1, す: 2, せ: 3, そ: 1,
  た: 4, ち: 2, つ: 1, て: 1, と: 2,
  な: 4, に: 3, ぬ: 2, ね: 2, の: 1,
  は: 3, ひ: 1, ふ: 4, へ: 1, ほ: 4,
  ま: 3, み: 2, む: 3, め: 2, も: 3,
  や: 3, ゆ: 2, よ: 2,
  ら: 2, り: 2, る: 1, れ: 2, ろ: 1,
  わ: 2, を: 3, ん: 1,
  が: 5, ぎ: 5, ぐ: 3, げ: 5, ご: 4,
  ざ: 5, じ: 3, ず: 4, ぜ: 5, ぞ: 3,
  だ: 6, ぢ: 4, づ: 3, で: 3, ど: 4,
  ば: 5, び: 3, ぶ: 6, べ: 3, ぼ: 6,
  ぱ: 4, ぴ: 2, ぷ: 5, ぺ: 2, ぽ: 5,
  // katakana
  ア: 2, イ: 2, ウ: 3, エ: 3, オ: 3,
  カ: 2, キ: 3, ク: 2, ケ: 3, コ: 2,
  サ: 3, シ: 3, ス: 2, セ: 2, ソ: 2,
  タ: 3, チ: 3, ツ: 3, テ: 3, ト: 2,
  ナ: 2, ニ: 2, ヌ: 2, ネ: 4, ノ: 1,
  ハ: 2, ヒ: 2, フ: 1, ヘ: 1, ホ: 4,
  マ: 2, ミ: 3, ム: 2, メ: 2, モ: 3,
  ヤ: 2, ユ: 2, ヨ: 3,
  ラ: 2, リ: 2, ル: 2, レ: 1, ロ: 3,
  ワ: 2, ヲ: 3, ン: 2,
  ガ: 4, ギ: 5, グ: 4, ゲ: 5, ゴ: 4,
  ザ: 5, ジ: 5, ズ: 4, ゼ: 4, ゾ: 4,
  ダ: 5, ヂ: 5, ヅ: 5, デ: 5, ド: 4,
  バ: 4, ビ: 4, ブ: 3, ベ: 3, ボ: 6,
  パ: 3, ピ: 3, プ: 2, ペ: 2, ポ: 5,
};

/** Optional hand templates for tighter stroke-order checks (stage-1 focus). */
const TEMPLATES: Record<string, Stroke[]> = {
  // Normalized 0–1 box; approximate textbook stroke order
  あ: [
    [{ x: 0.2, y: 0.28 }, { x: 0.8, y: 0.28 }],
    [
      { x: 0.55, y: 0.12 }, { x: 0.52, y: 0.45 }, { x: 0.35, y: 0.72 },
      { x: 0.45, y: 0.88 }, { x: 0.72, y: 0.78 },
    ],
    [
      { x: 0.62, y: 0.38 }, { x: 0.78, y: 0.42 }, { x: 0.82, y: 0.62 },
      { x: 0.7, y: 0.72 },
    ],
  ],
  い: [
    [{ x: 0.32, y: 0.18 }, { x: 0.28, y: 0.78 }],
    [{ x: 0.58, y: 0.28 }, { x: 0.72, y: 0.75 }],
  ],
  う: [
    [{ x: 0.35, y: 0.18 }, { x: 0.62, y: 0.2 }],
    [
      { x: 0.28, y: 0.38 }, { x: 0.55, y: 0.35 }, { x: 0.72, y: 0.48 },
      { x: 0.65, y: 0.78 }, { x: 0.4, y: 0.85 },
    ],
  ],
  え: [
    [{ x: 0.28, y: 0.22 }, { x: 0.7, y: 0.2 }],
    [
      { x: 0.22, y: 0.42 }, { x: 0.75, y: 0.4 }, { x: 0.55, y: 0.58 },
      { x: 0.35, y: 0.78 }, { x: 0.72, y: 0.82 },
    ],
  ],
  お: [
    [{ x: 0.22, y: 0.3 }, { x: 0.78, y: 0.28 }],
    [
      { x: 0.48, y: 0.12 }, { x: 0.48, y: 0.72 }, { x: 0.62, y: 0.85 },
      { x: 0.78, y: 0.7 },
    ],
    [{ x: 0.68, y: 0.42 }, { x: 0.82, y: 0.48 }],
  ],
  か: [
    [{ x: 0.35, y: 0.15 }, { x: 0.32, y: 0.85 }],
    [{ x: 0.22, y: 0.38 }, { x: 0.72, y: 0.32 }],
    [{ x: 0.62, y: 0.22 }, { x: 0.78, y: 0.75 }],
  ],
  き: [
    [{ x: 0.25, y: 0.28 }, { x: 0.75, y: 0.25 }],
    [{ x: 0.28, y: 0.48 }, { x: 0.72, y: 0.45 }],
    [
      { x: 0.48, y: 0.12 }, { x: 0.45, y: 0.62 }, { x: 0.35, y: 0.82 },
      { x: 0.65, y: 0.85 },
    ],
  ],
  く: [
    [{ x: 0.65, y: 0.15 }, { x: 0.3, y: 0.5 }, { x: 0.68, y: 0.88 }],
  ],
  け: [
    [{ x: 0.3, y: 0.15 }, { x: 0.28, y: 0.85 }],
    [{ x: 0.22, y: 0.4 }, { x: 0.55, y: 0.38 }],
    [{ x: 0.62, y: 0.22 }, { x: 0.7, y: 0.55 }, { x: 0.55, y: 0.82 }],
  ],
  こ: [
    [{ x: 0.28, y: 0.32 }, { x: 0.72, y: 0.3 }],
    [{ x: 0.28, y: 0.68 }, { x: 0.72, y: 0.72 }],
  ],
  ア: [
    [{ x: 0.55, y: 0.15 }, { x: 0.3, y: 0.55 }, { x: 0.55, y: 0.85 }],
    [{ x: 0.42, y: 0.48 }, { x: 0.78, y: 0.42 }],
  ],
  イ: [
    [{ x: 0.55, y: 0.15 }, { x: 0.35, y: 0.55 }],
    [{ x: 0.55, y: 0.35 }, { x: 0.55, y: 0.88 }],
  ],
  ウ: [
    [{ x: 0.35, y: 0.18 }, { x: 0.65, y: 0.18 }],
    [{ x: 0.28, y: 0.38 }, { x: 0.55, y: 0.35 }, { x: 0.72, y: 0.55 }],
    [{ x: 0.72, y: 0.4 }, { x: 0.7, y: 0.85 }],
  ],
};

export function expectedStrokeCount(char: string): number | null {
  return STROKE_COUNTS[char] ?? null;
}

export function getStrokeTemplate(char: string): KanaStrokeTemplate | null {
  const strokes = TEMPLATES[char];
  if (!strokes) return null;
  return { char, strokes };
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function resampleStroke(stroke: Stroke, n: number): Stroke {
  if (stroke.length === 0) return [];
  if (stroke.length === 1) return Array.from({ length: n }, () => ({ ...stroke[0]! }));

  let total = 0;
  for (let i = 1; i < stroke.length; i++) total += dist(stroke[i - 1]!, stroke[i]!);
  if (total < 1e-6) return Array.from({ length: n }, () => ({ ...stroke[0]! }));

  const out: Stroke = [{ ...stroke[0]! }];
  const step = total / (n - 1);
  let traveled = 0;
  let seg = 0;
  let segPos = 0;

  for (let i = 1; i < n - 1; i++) {
    const target = i * step;
    while (seg < stroke.length - 1) {
      const a = stroke[seg]!;
      const b = stroke[seg + 1]!;
      const len = dist(a, b);
      if (traveled + len - segPos >= target) {
        const t = (target - traveled + segPos) / (len || 1);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        break;
      }
      traveled += len;
      seg++;
      segPos = 0;
    }
  }
  out.push({ ...stroke[stroke.length - 1]! });
  return out;
}

/** Bounding-box normalize strokes into [0,1]² with padding. */
export function normalizeStrokes(strokes: Stroke[], pad = 0.08): Stroke[] {
  const pts = strokes.flat();
  if (pts.length === 0) return strokes.map(() => []);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  const size = Math.max(w, h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = (1 - pad * 2) / size;

  return strokes.map((s) =>
    s.map((p) => ({
      x: 0.5 + (p.x - cx) * scale,
      y: 0.5 + (p.y - cy) * scale,
    })),
  );
}

/** Classic DTW distance on resampled strokes; lower is better. */
function dtwDistance(a: Stroke, b: Stroke): number {
  const A = resampleStroke(a, 24);
  const B = resampleStroke(b, 24);
  const n = A.length;
  const m = B.length;
  const inf = 1e9;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => inf),
  );
  dp[0]![0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = dist(A[i - 1]!, B[j - 1]!);
      dp[i]![j] = cost + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[n]![m]! / (n + m);
}

/** Convert DTW distance to 0–1 similarity (roughly). */
function dtwSimilarity(a: Stroke, b: Stroke): number {
  const d = dtwDistance(a, b);
  // distance ~0.02 excellent, ~0.12 borderline, >0.2 bad
  return Math.max(0, Math.min(1, 1 - d / 0.18));
}

function strokeTemplateScore(user: Stroke[], template: Stroke[]): number {
  const u = normalizeStrokes(user);
  const t = normalizeStrokes(template);
  if (u.length === 0 || t.length === 0) return 0;
  // Match in order (stroke order required)
  const n = Math.min(u.length, t.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (u[i]!.length < 2 || t[i]!.length < 2) {
      sum += 0;
      continue;
    }
    sum += dtwSimilarity(u[i]!, t[i]!);
  }
  // Penalize extra/missing strokes already handled by count gate; still average over template length
  return sum / t.length;
}

function emptyGrid(): Uint8Array {
  return new Uint8Array(GRID * GRID);
}

function stampStroke(grid: Uint8Array, stroke: Stroke, radius = 1.35): void {
  if (stroke.length === 0) return;
  const rs = resampleStroke(stroke, Math.max(16, stroke.length * 3));
  for (const p of rs) {
    const cx = p.x * (GRID - 1);
    const cy = p.y * (GRID - 1);
    const r0 = Math.floor(cx - radius);
    const r1 = Math.ceil(cx + radius);
    const c0 = Math.floor(cy - radius);
    const c1 = Math.ceil(cy + radius);
    for (let y = c0; y <= c1; y++) {
      for (let x = r0; x <= r1; x++) {
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        if (Math.hypot(x - cx, y - cy) <= radius) {
          grid[y * GRID + x] = 1;
        }
      }
    }
  }
}

function inkGridFromStrokes(strokes: Stroke[]): Uint8Array {
  const g = emptyGrid();
  const norm = normalizeStrokes(strokes);
  for (const s of norm) stampStroke(g, s);
  return g;
}

let glyphCache: Map<string, Uint8Array> | null = null;

function renderGlyphGrid(char: string): Uint8Array {
  if (!glyphCache) glyphCache = new Map();
  const hit = glyphCache.get(char);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty = emptyGrid();
    glyphCache.set(char, empty);
    return empty;
  }
  ctx.clearRect(0, 0, GRID, GRID);
  ctx.fillStyle = "#000";
  // Serif JP matches the app’s reading aesthetic and has clean kana silhouettes
  ctx.font = `700 ${Math.floor(GRID * 0.78)}px "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, GRID / 2, GRID / 2 + 1);

  const { data } = ctx.getImageData(0, 0, GRID, GRID);
  const g = emptyGrid();
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // alpha-ish darkness
    if (data[i + 3]! > 40 && data[i]! < 200) g[p] = 1;
  }
  glyphCache.set(char, g);
  return g;
}

function inkIndices(grid: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i]) out.push(i);
  return out;
}

function cellXY(i: number): Point {
  return { x: i % GRID, y: Math.floor(i / GRID) };
}

/**
 * Coverage = share of glyph pixels near user ink.
 * Precision = share of user ink near glyph.
 * Combined shape score = harmonic mean (F1-like).
 */
export function silhouetteScores(
  userStrokes: Stroke[],
  char: string,
): { coverage: number; precision: number; shapeScore: number } {
  if (userStrokes.every((s) => s.length === 0)) {
    return { coverage: 0, precision: 0, shapeScore: 0 };
  }
  const user = inkGridFromStrokes(userStrokes);
  const glyph = renderGlyphGrid(char);
  const userPts = inkIndices(user);
  const glyphPts = inkIndices(glyph);
  if (userPts.length < 8 || glyphPts.length < 8) {
    return { coverage: 0, precision: 0, shapeScore: 0 };
  }

  const near = (from: number[], toGrid: Uint8Array): number => {
    let ok = 0;
    for (const i of from) {
      const { x, y } = cellXY(i);
      let best = Infinity;
      // local search first
      const r = Math.ceil(NEAR);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= GRID || yy >= GRID) continue;
          if (toGrid[yy * GRID + xx]) {
            best = Math.min(best, Math.hypot(dx, dy));
          }
        }
      }
      if (best <= NEAR) ok++;
    }
    return ok / from.length;
  };

  const coverage = near(glyphPts, user);
  const precision = near(userPts, glyph);
  const shapeScore =
    coverage + precision === 0
      ? 0
      : (2 * coverage * precision) / (coverage + precision);

  return { coverage, precision, shapeScore };
}

export function gradeKanaInk(
  userStrokes: Stroke[],
  char: string,
  opts: GradeOptions = {},
): GradeResult {
  const minShape = opts.minShapeScore ?? 0.78;
  const minCov = opts.minCoverage ?? 0.72;
  const minPrec = opts.minPrecision ?? 0.7;
  const requireCount = opts.requireStrokeCount ?? true;
  const requireTpl = opts.requireStrokeTemplate ?? true;
  const minStroke = opts.minStrokeScore ?? 0.62;

  const cleaned = userStrokes.filter((s) => s.length >= 2);
  const actualStrokes = cleaned.length;
  const expected = expectedStrokeCount(char);
  const reasons: string[] = [];

  if (actualStrokes === 0) {
    return {
      pass: false,
      shapeScore: 0,
      coverage: 0,
      precision: 0,
      strokeScore: null,
      expectedStrokes: expected,
      actualStrokes: 0,
      reasons: ["Draw the character first."],
    };
  }

  let countOk = true;
  if (requireCount && expected != null && actualStrokes !== expected) {
    countOk = false;
    reasons.push(
      actualStrokes < expected
        ? `Too few strokes (${actualStrokes}/${expected}).`
        : `Too many strokes (${actualStrokes}/${expected}).`,
    );
  }

  const { coverage, precision, shapeScore } = silhouetteScores(cleaned, char);
  if (coverage < minCov) {
    reasons.push("Shape doesn’t cover the character well — follow the form more closely.");
  }
  if (precision < minPrec) {
    reasons.push("Too much extra ink outside the character — cleaner strokes.");
  }
  if (shapeScore < minShape) {
    reasons.push(`Shape score ${Math.round(shapeScore * 100)}% (need ${Math.round(minShape * 100)}%+).`);
  }

  let strokeScore: number | null = null;
  let strokeOk = true;
  const tpl = getStrokeTemplate(char);
  if (tpl && requireTpl) {
    strokeScore = strokeTemplateScore(cleaned, tpl.strokes);
    if (strokeScore < minStroke) {
      strokeOk = false;
      reasons.push(
        `Stroke path ${Math.round(strokeScore * 100)}% (need ${Math.round(minStroke * 100)}%+) — check stroke order and direction.`,
      );
    }
  }

  const shapeOk = shapeScore >= minShape && coverage >= minCov && precision >= minPrec;
  const pass = countOk && shapeOk && strokeOk;

  if (pass) reasons.length = 0;

  return {
    pass,
    shapeScore,
    coverage,
    precision,
    strokeScore,
    expectedStrokes: expected,
    actualStrokes,
    reasons: pass ? ["Looks solid."] : reasons,
  };
}
