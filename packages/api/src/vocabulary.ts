/**
 * Vocabulary + kanji progress persistence (device-scoped until Phase 4 auth).
 */
import type {
  KanjiCardState,
  KanjiProgress,
  VocabularyClip,
  VocabularyEntry,
} from "@joylingo/shared";

export const VOCABULARY_SCHEMA = `
CREATE TABLE IF NOT EXISTS vocabulary_entries (
  user_id           TEXT NOT NULL,
  dict              TEXT NOT NULL,
  reading           TEXT NOT NULL,
  gloss             TEXT,
  surface           TEXT NOT NULL,
  tap_count         INTEGER NOT NULL DEFAULT 1,
  mined             BOOLEAN NOT NULL DEFAULT false,
  first_seen_at     TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ NOT NULL,
  first_episode_id  TEXT NOT NULL,
  first_line_id     TEXT NOT NULL,
  last_episode_id   TEXT NOT NULL,
  last_line_id      TEXT NOT NULL,
  PRIMARY KEY (user_id, dict)
);

CREATE TABLE IF NOT EXISTS kanji_progress (
  user_id           TEXT NOT NULL,
  char              TEXT NOT NULL,
  encounter_count   INTEGER NOT NULL DEFAULT 0,
  example_dicts     JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'seen',
  first_seen_at     TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, char)
);

CREATE TABLE IF NOT EXISTS kanji_cards (
  user_id           TEXT NOT NULL,
  char              TEXT NOT NULL,
  interval_days     INTEGER NOT NULL DEFAULT 0,
  repetitions       INTEGER NOT NULL DEFAULT 0,
  due_at            TIMESTAMPTZ NOT NULL,
  last_reviewed_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, char)
);
`;

interface VocabRow {
  dict: string;
  reading: string;
  gloss: string | null;
  surface: string;
  tap_count: number;
  mined: boolean;
  first_seen_at: Date;
  last_seen_at: Date;
  first_episode_id: string;
  first_line_id: string;
  last_episode_id: string;
  last_line_id: string;
}

function clipFromRow(r: VocabRow, first: boolean): VocabularyClip {
  return first
    ? { episodeId: r.first_episode_id, lineId: r.first_line_id }
    : { episodeId: r.last_episode_id, lineId: r.last_line_id };
}

function rowToEntry(r: VocabRow): VocabularyEntry {
  return {
    dict: r.dict,
    reading: r.reading,
    gloss: r.gloss,
    surface: r.surface,
    tapCount: r.tap_count,
    mined: r.mined,
    firstSeenAt: r.first_seen_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString(),
    firstClip: clipFromRow(r, true),
    lastClip: clipFromRow(r, false),
  };
}

export interface EncounterBody {
  dict: string;
  reading: string;
  gloss: string | null;
  surface: string;
  episodeId: string;
  lineId: string;
  mined?: boolean;
}

export async function upsertEncounter(
  db: import("./db.js").DB,
  userId: string,
  body: EncounterBody,
): Promise<VocabularyEntry> {
  const now = new Date();
  const res = await db.query<VocabRow>(
    `INSERT INTO vocabulary_entries
       (user_id, dict, reading, gloss, surface, tap_count, mined,
        first_seen_at, last_seen_at,
        first_episode_id, first_line_id, last_episode_id, last_line_id)
     VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $7, $8, $9, $8, $9)
     ON CONFLICT (user_id, dict) DO UPDATE SET
       reading = EXCLUDED.reading,
       gloss = EXCLUDED.gloss,
       surface = EXCLUDED.surface,
       tap_count = vocabulary_entries.tap_count + 1,
       mined = vocabulary_entries.mined OR EXCLUDED.mined,
       last_seen_at = EXCLUDED.last_seen_at,
       last_episode_id = EXCLUDED.last_episode_id,
       last_line_id = EXCLUDED.last_line_id
     RETURNING dict, reading, gloss, surface, tap_count, mined,
       first_seen_at, last_seen_at,
       first_episode_id, first_line_id, last_episode_id, last_line_id`,
    [
      userId,
      body.dict,
      body.reading,
      body.gloss,
      body.surface,
      body.mined ?? false,
      now,
      body.episodeId,
      body.lineId,
    ],
  );
  return rowToEntry(res.rows[0]!);
}

export async function listVocabulary(
  db: import("./db.js").DB,
  userId: string,
  opts?: { mined?: boolean },
): Promise<VocabularyEntry[]> {
  let sql = `SELECT dict, reading, gloss, surface, tap_count, mined,
    first_seen_at, last_seen_at,
    first_episode_id, first_line_id, last_episode_id, last_line_id
    FROM vocabulary_entries WHERE user_id = $1`;
  const params: unknown[] = [userId];
  if (opts?.mined === true) {
    sql += " AND mined = true";
  } else if (opts?.mined === false) {
    sql += " AND mined = false";
  }
  sql += " ORDER BY last_seen_at DESC";
  const res = await db.query<VocabRow>(sql, params);
  return res.rows.map(rowToEntry);
}

export async function setVocabularyMined(
  db: import("./db.js").DB,
  userId: string,
  dict: string,
): Promise<void> {
  await db.query(
    "UPDATE vocabulary_entries SET mined = true WHERE user_id = $1 AND dict = $2",
    [userId, dict],
  );
}

/** Idempotent upsert for bidirectional client sync (sets counts, does not increment). */
export async function syncVocabularyEntries(
  db: import("./db.js").DB,
  userId: string,
  entries: VocabularyEntry[],
): Promise<void> {
  for (const entry of entries) {
    await db.query(
      `INSERT INTO vocabulary_entries
         (user_id, dict, reading, gloss, surface, tap_count, mined,
          first_seen_at, last_seen_at,
          first_episode_id, first_line_id, last_episode_id, last_line_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id, dict) DO UPDATE SET
         reading = EXCLUDED.reading,
         gloss = EXCLUDED.gloss,
         surface = EXCLUDED.surface,
         tap_count = GREATEST(vocabulary_entries.tap_count, EXCLUDED.tap_count),
         mined = vocabulary_entries.mined OR EXCLUDED.mined,
         first_seen_at = LEAST(vocabulary_entries.first_seen_at, EXCLUDED.first_seen_at),
         last_seen_at = GREATEST(vocabulary_entries.last_seen_at, EXCLUDED.last_seen_at),
         first_episode_id = CASE
           WHEN EXCLUDED.first_seen_at < vocabulary_entries.first_seen_at
           THEN EXCLUDED.first_episode_id
           ELSE vocabulary_entries.first_episode_id
         END,
         first_line_id = CASE
           WHEN EXCLUDED.first_seen_at < vocabulary_entries.first_seen_at
           THEN EXCLUDED.first_line_id
           ELSE vocabulary_entries.first_line_id
         END,
         last_episode_id = CASE
           WHEN EXCLUDED.last_seen_at > vocabulary_entries.last_seen_at
           THEN EXCLUDED.last_episode_id
           ELSE vocabulary_entries.last_episode_id
         END,
         last_line_id = CASE
           WHEN EXCLUDED.last_seen_at > vocabulary_entries.last_seen_at
           THEN EXCLUDED.last_line_id
           ELSE vocabulary_entries.last_line_id
         END`,
      [
        userId,
        entry.dict,
        entry.reading,
        entry.gloss,
        entry.surface,
        entry.tapCount,
        entry.mined,
        entry.firstSeenAt,
        entry.lastSeenAt,
        entry.firstClip.episodeId,
        entry.firstClip.lineId,
        entry.lastClip.episodeId,
        entry.lastClip.lineId,
      ],
    );
  }
}

interface KanjiProgRow {
  char: string;
  encounter_count: number;
  example_dicts: string[];
  status: string;
  first_seen_at: Date;
  last_seen_at: Date;
}

export async function upsertKanjiProgress(
  db: import("./db.js").DB,
  userId: string,
  chars: string[],
  dict: string,
  tapCount: number,
  seenAt: Date,
): Promise<void> {
  for (const char of chars) {
    const existing = await db.query<KanjiProgRow>(
      `SELECT char, encounter_count, example_dicts, status, first_seen_at, last_seen_at
       FROM kanji_progress WHERE user_id = $1 AND char = $2`,
      [userId, char],
    );
    const row = existing.rows[0];
    if (row) {
      const examples = [...new Set([dict, ...(Array.isArray(row.example_dicts) ? row.example_dicts : [])])].slice(0, 5);
      const newCount = row.encounter_count + tapCount;
      await db.query(
        `UPDATE kanji_progress SET
           encounter_count = encounter_count + $3,
           last_seen_at = $4,
           example_dicts = $5::jsonb
         WHERE user_id = $1 AND char = $2`,
        [userId, char, tapCount, seenAt, JSON.stringify(examples)],
      );
      if (newCount >= 2) {
        await seedKanjiCardIfMissing(db, userId, char, seenAt);
      }
    } else {
      await db.query(
        `INSERT INTO kanji_progress
           (user_id, char, encounter_count, example_dicts, status, first_seen_at, last_seen_at)
         VALUES ($1, $2, $3, $4::jsonb, 'seen', $5, $5)`,
        [userId, char, tapCount, JSON.stringify([dict]), seenAt],
      );
    }
  }
}

async function seedKanjiCardIfMissing(
  db: import("./db.js").DB,
  userId: string,
  char: string,
  dueAt: Date,
): Promise<void> {
  await db.query(
    `INSERT INTO kanji_cards (user_id, char, interval_days, repetitions, due_at)
     VALUES ($1, $2, 0, 0, $3)
     ON CONFLICT (user_id, char) DO NOTHING`,
    [userId, char, dueAt],
  );
}

export async function listKanjiProgress(
  db: import("./db.js").DB,
  userId: string,
): Promise<KanjiProgress[]> {
  const res = await db.query<KanjiProgRow>(
    `SELECT char, encounter_count, example_dicts, status, first_seen_at, last_seen_at
     FROM kanji_progress WHERE user_id = $1 ORDER BY encounter_count DESC`,
    [userId],
  );
  return res.rows.map((r) => ({
    char: r.char,
    encounterCount: r.encounter_count,
    exampleDicts: Array.isArray(r.example_dicts) ? r.example_dicts : [],
    status: r.status as KanjiProgress["status"],
    firstSeenAt: r.first_seen_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString(),
  }));
}

interface KanjiCardRow {
  char: string;
  interval_days: number;
  repetitions: number;
  due_at: Date;
  last_reviewed_at: Date | null;
}

export async function listKanjiCards(
  db: import("./db.js").DB,
  userId: string,
): Promise<KanjiCardState[]> {
  const res = await db.query<KanjiCardRow>(
    `SELECT char, interval_days, repetitions, due_at, last_reviewed_at
     FROM kanji_cards WHERE user_id = $1`,
    [userId],
  );
  return res.rows.map((r) => ({
    char: r.char,
    intervalDays: r.interval_days,
    repetitions: r.repetitions,
    dueAt: r.due_at.toISOString(),
    lastReviewedAt: r.last_reviewed_at?.toISOString() ?? null,
  }));
}

export async function upsertKanjiCard(
  db: import("./db.js").DB,
  userId: string,
  card: KanjiCardState,
): Promise<void> {
  await db.query(
    `INSERT INTO kanji_cards (user_id, char, interval_days, repetitions, due_at, last_reviewed_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, char) DO UPDATE SET
       interval_days = EXCLUDED.interval_days,
       repetitions = EXCLUDED.repetitions,
       due_at = EXCLUDED.due_at,
       last_reviewed_at = EXCLUDED.last_reviewed_at`,
    [
      userId,
      card.char,
      card.intervalDays,
      card.repetitions,
      card.dueAt,
      card.lastReviewedAt,
    ],
  );
}
