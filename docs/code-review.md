# Code Review: Phase 1–2 Web App

**Scope:** `packages/web`, `packages/player-core` — immersion player, player adapters, deck UI, routing.

**Date:** 2026-07-05

**Test status:** Pipeline tests pass (21/21). No tests exist for the new client packages.

**Resolution (2026-07-05):** Findings #1–#4, #6–#9 fixed; #5, #10–#12 accepted as known MVP limitations. Added 15 unit tests for `player-core` (deck, findActiveLine, MockPlayerAdapter) — suite now 36/36. Per-item status inline below.

---

## High severity

### 1. Review modal skips cards after grading

`ReviewModal` indexes into `cards` with local `idx`, but the parent passes live `dueCards` that **shrinks** when a card is marked `known`:

```tsx
// ImmersionPlayer.tsx
{reviewing && (
  <ReviewModal
    cards={dueCards}
    onGrade={(dict, good) =>
      setKnowledge((k) => {
        const entry = k[dict];
        return entry ? { ...k, [dict]: { ...entry, status: good ? "known" : "learning" } } : k;
      })
    }
```

After grading card 0 as Good, `idx` becomes 1 while `dueCards` is re-filtered — `cards[1]` is now the **third** original card.

**Repro:** Mine 3 words → Review → Good on first → second card skipped.

**Fix:** Snapshot `cards` when opening review (`useState(dueCards)` on open), or grade by `dict` + stable queue, not shrinking array index.

**Status: fixed** — `ReviewModal` snapshots the queue on mount (`useState(() => cards)`).

---

### 2. YouTube API load failure hangs forever

`YouTubePlayerAdapter.loadIframeApi()` never rejects — if the script fails or `onYouTubeIframeAPIReady` never fires, the adapter stays `ready=false`, `lastTime=0`, no error surfaced to UI.

User sees blank player, subtitles never sync, no feedback.

**Fix:** Timeout + reject; surface error in `ImmersionPlayer` (fallback message or mock mode).

**Status: fixed** — `loadIframeApi()` polls for `window.YT.Player` and rejects after 10s; adapter takes an `onError` callback (also wired to YT playback errors); `ImmersionPlayer` renders the message over the player frame.

---

## Medium severity

### 3. Adapter recreated on any `source` reference change

```tsx
// ImmersionPlayer.tsx
useEffect(() => {
  if (!episode) return;
  const a: PlayerAdapter = source.youtubeVideoId
    ? new YouTubePlayerAdapter(YT_MOUNT_ID, source.youtubeVideoId)
    : new MockPlayerAdapter(episode.duration);
  setAdapter(a);
  return () => {
    a.destroy();
    setAdapter(null);
  };
}, [episode, source]);
```

Effect depends on whole `source` object. If parent re-fetches manifest and passes a new object reference (same `episodeId`), YouTube player is destroyed/recreated mid-watch.

**Fix:** Depend on `source.episodeId`, `source.youtubeVideoId`, `episode.duration` only.

**Status: fixed** — effect depends on `episode` + destructured `youtubeVideoId` only.

---

### 4. Episode / manifest JSON not validated at runtime

`packages/web/src/lib/episodes.ts` uses `as Episode` / `as { episodes: EpisodeSource[] }` with no shape check. Bad or partial JSON → runtime errors deep in render (e.g. missing `lines`, `tokens`).

**Fix:** Lightweight validator (zod or manual guards) at fetch boundary; show load error instead of white screen.

**Status: fixed** — manual shape guards in `episodes.ts` (no new deps); malformed JSON throws a descriptive error rendered by the existing `loadError` path.

---

### 5. Video duration vs subtitle duration mismatch

Progress bar and ticks use `clock.duration` (YouTube video length) but line positions come from subtitle `start`/`end` (episode JSON). For a long YouTube video with short subs, ticks cluster at the left; seeking by progress bar lands in unsubtitled regions with no active line.

Expected for MVP, but worth documenting or capping bar to `episode.duration` when subs are shorter.

**Status: accepted** — known MVP limitation; revisit when real full-length episodes are bound.

---

### 6. `activeLine` lookup is O(n) per tick; inclusive end can overlap

```tsx
const activeLine = useMemo(
  () => episode?.lines.find((l) => subTime >= l.start && subTime <= l.end) ?? null,
  [episode, subTime],
);
```

- Polls ~4×/sec via YouTube — fine for 8 lines, not for full anime episodes (hundreds of cues).
- Inclusive `<= end` on adjacent cues with shared boundary → first match wins (subtitle flicker risk).

**Fix:** Binary search + half-open interval `[start, end)` (noted in BUILD_GUIDE).

**Status: fixed** — `findActiveLine()` in player-core (binary search, half-open intervals), unit-tested; `ImmersionPlayer` uses it.

---

### 7. Dev ergonomics: workspace packages resolve to `dist/`

`@joylingo/player-core` and `@joylingo/shared` point at compiled `dist/`. `predev`/`pretest` mitigate, but editing `player-core` source without rebuild shows stale code. No Vite alias to `src/`.

**Fix:** Vite `resolve.alias` for dev, or document `npm run build -w @joylingo/player-core` after edits.

**Status: fixed** — `vite.config.ts` aliases `@joylingo/player-core` and `@joylingo/shared` to their `src/`; production build verified.

---

## Low severity

### 8. Context cloze uses first `replace` only

```tsx
// ReviewModal.tsx
card.context.replace(card.surface, "＿＿")
```

Only first occurrence replaced; repeated surface forms leak answers. Same as prototype — acceptable short-term.

**Status: fixed** — `replaceAll`.

---

### 9. Transcript times ignore subtitle offset

`Transcript.tsx` shows `formatTime(l.start)` but `jumpToLine` seeks with offset. Displayed times ≠ video timeline when offset ≠ 0.

**Status: fixed** — `Transcript` takes an `offset` prop and displays `l.start + offset` (clamped at 0).

---

### 10. Deck keyed by `dict` only

Homographs / same lemma mined twice overwrite prior context. Matches prototype; document until Phase 5.

**Status: accepted** — known limitation until Phase 5 (Postgres + FSRS).

---

### 11. Sync offset not persisted

Slider resets on reload unless manually edited in `index.json`. Fine for dev; note for users.

**Status: accepted** — persistence lands with the Phase 3 backend.

---

### 12. YouTube mode has no in-app play/pause

Mock player has controls; YouTube relies on native iframe controls. Progress bar seek still works. UX gap, not a bug.

**Status: accepted** — native iframe controls suffice for MVP.

---

## Security

- **Low risk:** Episode JSON is static/same-origin; React escapes rendered text — no obvious XSS.
- **Third-party script:** YouTube IFrame API loaded from Google in `packages/web/index.html` — expected; standard CSP considerations for production deploy.
- **No auth/secrets** in client code yet — nothing to leak.

---

## Missing tests

| Area | Coverage |
|------|----------|
| `packages/pipeline` | 21 tests — good |
| `packages/player-core/deck.ts` | 6 tests — `lineText`, `mineEntry`, `toDeck` |
| `MockPlayerAdapter` | 5 tests — seek clamps, auto-pause at end, restart, subscriptions |
| `YouTubePlayerAdapter` | None — needs mocking `window.YT` |
| `findActiveLine` | 4 tests — boundaries, half-open intervals, gaps, empty input |
| Web components | None — consider one integration test later |

---

## What's working well

- Clean `PlayerAdapter` abstraction — mock ↔ YouTube swap is isolated
- Hooks called before early returns in `ImmersionPlayer` — rules of hooks respected
- `pretest` / `predev` + `build` scripts fix the original `@joylingo/shared` dist issue
- `isWord()` used in `SubtitleLine`; null gloss handled in `DictionaryCard`
- `destroy()` on adapter cleanup prevents timer/iframe leaks
- Subtitle offset model (`subTime = clock - offset`) is consistent across lookup, seek, and progress ticks

---

## Suggested fix priority

1. Review modal queue bug (#1)
2. YouTube load error handling (#2)
3. Stabilize adapter effect deps (#3)
4. Unit tests for `deck.ts` + active-line helper (#6, missing tests)
5. Runtime JSON validation (#4)
