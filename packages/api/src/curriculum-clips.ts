/**
 * Fusion deck persistence — curriculum-sourced clip cards.
 */
import type { ClipCandidate, FusionCard, FusionCardStatus } from "@joylingo/shared";

export const FUSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS fusion_cards (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  curriculum_word_id  TEXT NOT NULL,
  dict                TEXT NOT NULL,
  reading             TEXT NOT NULL DEFAULT '',
  gloss_expected      TEXT NOT NULL,
  surface             TEXT NOT NULL,
  context_ja          TEXT NOT NULL,
  context_en          TEXT,
  episode_id          TEXT NOT NULL,
  line_id             TEXT NOT NULL,
  clip_start          DOUBLE PRECISION NOT NULL,
  clip_end            DOUBLE PRECISION NOT NULL,
  timing_source       TEXT NOT NULL DEFAULT 'proportional',
  status              TEXT NOT NULL DEFAULT 'learning',
  interval_days       INTEGER NOT NULL DEFAULT 0,
  due_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, curriculum_word_id, episode_id, line_id)
);
`;

interface FusionRow {
  id: string;
  curriculum_word_id: string;
  dict: string;
  reading: string;
  gloss_expected: string;
  surface: string;
  context_ja: string;
  context_en: string | null;
  episode_id: string;
  line_id: string;
  clip_start: number;
  clip_end: number;
  timing_source: string;
  status: FusionCardStatus;
  interval_days: number;
  due_at: Date;
  last_reviewed_at: Date | null;
  created_at: Date;
}

function rowToCard(r: FusionRow): FusionCard {
  return {
    id: r.id,
    curriculumWordId: r.curriculum_word_id,
    dict: r.dict,
    reading: r.reading,
    glossExpected: r.gloss_expected,
    surface: r.surface,
    contextJa: r.context_ja,
    contextEn: r.context_en,
    episodeId: r.episode_id,
    lineId: r.line_id,
    clipStart: r.clip_start,
    clipEnd: r.clip_end,
    timingSource: r.timing_source === "karaoke" ? "karaoke" : "proportional",
    status: r.status,
    intervalDays: r.interval_days,
    dueAt: r.due_at.toISOString(),
    lastReviewedAt: r.last_reviewed_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

const SELECT_COLS = `id, curriculum_word_id, dict, reading, gloss_expected, surface,
  context_ja, context_en, episode_id, line_id, clip_start, clip_end, timing_source,
  status, interval_days, due_at, last_reviewed_at, created_at`;

export async function listFusionCards(
  db: import("./db.js").DB,
  userId: string,
): Promise<FusionCard[]> {
  const res = await db.query<FusionRow>(
    `SELECT ${SELECT_COLS} FROM fusion_cards WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows.map(rowToCard);
}

export async function listDueFusionCards(
  db: import("./db.js").DB,
  userId: string,
): Promise<FusionCard[]> {
  const res = await db.query<FusionRow>(
    `SELECT ${SELECT_COLS} FROM fusion_cards
     WHERE user_id = $1 AND status = 'learning' AND due_at <= now()
     ORDER BY due_at ASC`,
    [userId],
  );
  return res.rows.map(rowToCard);
}

export interface SaveClipInput {
  curriculumWordId: string;
  dict: string;
  reading: string;
  glossExpected: string;
  surface: string;
  contextJa: string;
  contextEn: string | null;
  episodeId: string;
  lineId: string;
  clipStart: number;
  clipEnd: number;
  timingSource: "karaoke" | "proportional";
}

export function candidateToSaveInput(
  c: ClipCandidate,
  glossExpected: string,
  reading: string,
): SaveClipInput {
  return {
    curriculumWordId: c.curriculumWordId,
    dict: c.dict,
    reading,
    glossExpected,
    surface: c.surface,
    contextJa: c.contextJa,
    contextEn: c.contextEn,
    episodeId: c.episodeId,
    lineId: c.lineId,
    clipStart: c.clipStart,
    clipEnd: c.clipEnd,
    timingSource: c.timingSource,
  };
}

export async function saveFusionClips(
  db: import("./db.js").DB,
  userId: string,
  clips: SaveClipInput[],
): Promise<FusionCard[]> {
  const saved: FusionCard[] = [];
  for (const clip of clips) {
    const id = crypto.randomUUID();
    const res = await db.query<FusionRow>(
      `INSERT INTO fusion_cards
         (id, user_id, curriculum_word_id, dict, reading, gloss_expected, surface,
          context_ja, context_en, episode_id, line_id, clip_start, clip_end, timing_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (user_id, curriculum_word_id, episode_id, line_id) DO NOTHING
       RETURNING ${SELECT_COLS}`,
      [
        id,
        userId,
        clip.curriculumWordId,
        clip.dict,
        clip.reading,
        clip.glossExpected,
        clip.surface,
        clip.contextJa,
        clip.contextEn,
        clip.episodeId,
        clip.lineId,
        clip.clipStart,
        clip.clipEnd,
        clip.timingSource,
      ],
    );
    if (res.rows[0]) saved.push(rowToCard(res.rows[0]));
  }
  return saved;
}

export async function getFusionCard(
  db: import("./db.js").DB,
  userId: string,
  id: string,
): Promise<FusionCard | null> {
  const res = await db.query<FusionRow>(
    `SELECT ${SELECT_COLS} FROM fusion_cards WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return res.rows[0] ? rowToCard(res.rows[0]) : null;
}

export async function updateFusionCard(
  db: import("./db.js").DB,
  userId: string,
  card: FusionCard,
): Promise<void> {
  await db.query(
    `UPDATE fusion_cards SET
       status = $3, interval_days = $4, due_at = $5, last_reviewed_at = $6
     WHERE user_id = $1 AND id = $2`,
    [
      userId,
      card.id,
      card.status,
      card.intervalDays,
      card.dueAt,
      card.lastReviewedAt,
    ],
  );
}
