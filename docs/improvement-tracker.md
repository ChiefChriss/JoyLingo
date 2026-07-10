# JoyLingo Improvement Tracker

> Loop reads this file each tick. Pick the **first unchecked** item in **Active Sprint**, implement it, run tests, then mark `[x]` and add completion date.

**Last updated:** 2026-07-08 (L3)  
**Loop:** `memory/loop-improvement-tracker.md` · sentinel `AGENT_LOOP_WAKE_improvement-tracker`

---

## Active Sprint (do these first)

| # | Status | Task | Area | Priority |
|---|--------|------|------|----------|
| S1 | [x] | Wire `JimakuKeySettings` into `SettingsPage` (BYOK when server has no key) | Media | Quick win |
| S2 | [x] | Add `ETag` + `Cache-Control` on `GET /api/episodes/:id` | Caching | Quick win |
| S3 | [x] | Upsert episodes on re-import (YouTube ID / anime tuple) instead of duplicate slugs | Media | P0 |
| S4 | [x] | Expand fusion clips to **all** vocab lessons (not just 03 & 05) | Curriculum | Quick win |
| S5 | [x] | Hydrate vocabulary from API on app boot (merge with localStorage) | Learning | Quick win |

---

## Media Management

| # | Status | Task | Priority |
|---|--------|------|----------|
| M1 | [x] | Stream health check before binding `<video>`; show re-resolve CTA on failure | P0 |
| M2 | [x] | Source quality picker (expose multiple AllAnime sources) | P1 |
| M3 | [x] | Jimaku release mapping cache (`youtube_video_id` ↔ `jimaku_entry_id`) | P1 |
| M4 | [x] | Subtitle provenance UI (YouTube / Jimaku / manual + enriched timestamp) | P2 |
| M5 | [x] | Local file / browser extension video adapter | P3 |

---

## Caching

| # | Status | Task | Priority |
|---|--------|------|----------|
| C1 | [x] | Client episode cache in IndexedDB (keyed by `episodeId` + `generatedAt`) | P1 |
| C2 | [x] | Catalog manifest cache with stale-while-revalidate | P1 |
| C3 | [x] | Enrich job dedup by subtitle content hash | P2 |
| C4 | [x] | Jikan / AllAnime metadata TTL cache (24h) | P2 |
| C5 | [x] | `immutable` cache headers for static curriculum on Vercel | P3 |

---

## Learning Styles & Pedagogy

| # | Status | Task | Priority |
|---|--------|------|----------|
| L1 | [x] | FSRS for word deck (`ts-fsrs`); wire `ReviewModal` Again/Good | P0 |
| L2 | [x] | Clip replay in word review (use `firstClip` / `lastClip` refs) | P0 |
| L3 | [x] | Bidirectional vocab sync (merge API + localStorage on boot) | P1 |
| L4 | [ ] | `preferredMode` in profile (`immersion` / `structured` / `mixed`) | P1 |
| L5 | [ ] | Sentence mining — mine full `Line` with cloze on target token | P2 |
| L6 | [ ] | Listening mode — hide JA or EN subtitles on demand | P2 |
| L7 | [ ] | Kana SRS after baseline stages complete | P2 |
| L8 | [ ] | Shadowing — loop current line using token `t0`/`t1` karaoke timings | P3 |
| L9 | [ ] | Watch time + streak tracking for curriculum goals | P3 |

---

## Curriculum

| # | Status | Task | Priority |
|---|--------|------|----------|
| U1 | [ ] | Unify hybrid path + EDU curriculum (single progress model + handoff) | P0 |
| U2 | [ ] | Grammar lesson interactivity (parse exercise blocks from markdown) | P1 |
| U3 | [ ] | Placement result routes to `currentLessonId` and skips redundant kana | P1 |
| U4 | [ ] | Curriculum-aware mining highlights (lesson vocab in subtitles) | P2 |
| U5 | [ ] | JLPT goal filter lens on deck, fusion, episode recommendations | P2 |
| U6 | [ ] | Personalized episode queue from `favoriteAnime` + progress | P2 |
| U7 | [ ] | Spaced grammar review deck from subtitle POS tags | P3 |
| U8 | [ ] | Export/import deck JSON (community decks later) | P3 |

---

## Infrastructure

| # | Status | Task | Priority |
|---|--------|------|----------|
| I1 | [ ] | Auth (magic-link or OAuth) — replace anonymous `device-id` | P0 |
| I2 | [ ] | Migrate PGlite → hosted Postgres (Railway) | P0 |
| I3 | [ ] | Word deck + FSRS state in Postgres | P1 |
| I4 | [ ] | Curriculum progress API persistence | P1 |
| I5 | [ ] | Enrich job queue (pg-boss or BullMQ) | P2 |
| I6 | [ ] | Structured observability (enrich failures, stream errors, Jimaku 429s) | P2 |
| I7 | [ ] | iOS via Expo (share `player-core`) | P3 |

---

## Completed Log

<!-- Move finished rows here with date and PR/commit ref -->

| ID | Completed | Notes |
|----|-----------|-------|
| L3 | 2026-07-08 | Pull merge + push local-wins via POST /api/vocabulary/sync |
| L2 | 2026-07-08 | lastClip replay + first encounter; inline replay on same episode |
| L1 | 2026-07-08 | ts-fsrs gradeWordCard; dueAt scheduling; ReviewModal wired |
| C5 | 2026-07-08 | vercel.json Cache-Control immutable for /curriculum/* |
| C4 | 2026-07-08 | 24h TtlCache on Jikan search/anime/episodes + AllAnime search/match/lists |
| C3 | 2026-07-08 | SHA-256 subtitle hash; skip pipeline + in-flight job dedup |
| C2 | 2026-07-08 | IDB manifest cache + SWR; API manifest ETag + 304 |
| C1 | 2026-07-08 | IndexedDB episode cache + If-None-Match revalidation; offline fallback |
| M5 | 2026-07-08 | Session blob local video via HtmlVideoPlayerAdapter; extension deferred |
| M4 | 2026-07-08 | subtitle_source column + SubtitleProvenance in player header |
| M3 | 2026-07-08 | jimaku_youtube_mappings table + auto-load in attach modal |
| M2 | 2026-07-08 | Quality select when multiple playable CDN sources |
| M1 | 2026-07-08 | probeStreamUrl + findPlayableStreamSource; Re-resolve stream CTA |
| S5 | 2026-07-08 | hydrateVocabularyFromApi + mergeVocabularyMaps tests; race fixes |
| S4 | 2026-07-08 | API resolves fusionVocabLessonId; grammar 02/04/06; deck state lift fix |
| S3 | 2026-07-08 | resolveEpisodeId by YouTube/anime; merge existing bindings on re-import |
| S2 | 2026-07-08 | ETag from id+generatedAt; Cache-Control 1h; 304 on If-None-Match |
| S1 | 2026-07-08 | SettingsPage + JimakuKeySettings BYOK; reviewer fixes applied |

---

## Loop QA Protocol

Each tick:
1. Read this tracker → pick first `[ ]` in **Active Sprint**, else lowest-ID unchecked item.
2. **Builder subagent** implements the task (focused diff, match conventions).
3. **Reviewer subagent** (`cavecrew-reviewer`) audits the diff — block mark-done if critical issues.
4. Run `npm test` (or scoped package tests) + `npm run typecheck`.
5. Mark `[x]`, log in **Completed Log**, update **Last updated**.
