# JoyLingo

Learn Japanese by immersion — watch anime/shows with interactive Japanese
subtitles: tap a word to look it up, then mine it into a spaced-repetition deck.
Targets iPhone and web.

JoyLingo doesn't host or scrape video. It's a **bring-your-own-media** learning
layer (like Migaku / Language Reactor) over content you legitimately access —
starting with officially uploaded anime on YouTube.

## How it works

- **Swappable player** — the app consumes only a `currentTime` from a player
  adapter (YouTube IFrame first; a `<video>` tag or browser extension later).
  Everything else is player-agnostic.
- **Enrichment pipeline** — subtitles are pre-processed on the backend:
  parse `.srt`/`.ass` → tokenize with kuromoji → attach JMdict glosses &
  readings → serve JSON. The client just renders it; it never tokenizes.
- **Learning loop** — tap a word → add to your deck with sentence context →
  review with spaced repetition (FSRS); cards link back to their clip.

## Repo layout

| Path | What |
| --- | --- |
| [`packages/shared`](packages/shared) | The `Episode`/`Line`/`Token` JSON contract shared by pipeline, backend, and clients |
| [`packages/pipeline`](packages/pipeline) | Subtitle enrichment pipeline + `joylingo-enrich` CLI — see its [README](packages/pipeline/README.md) |
| [`packages/player-core`](packages/player-core) | Player-agnostic client logic: `PlayerAdapter` (mock + YouTube IFrame), `usePlaybackClock`, deck types |
| [`packages/api`](packages/api) | Fastify backend — episode catalog (PGlite/Postgres), Jimaku proxy, server-side enrichment |
| [`packages/web`](packages/web) | Vite + React web app — home (recommendations + paste-URL), immersion player, `/watch/:episodeId` |
| `immersion_player_prototype.jsx` | React prototype the web app was ported from (kept for reference) |

## Quick start

```bash
npm install                 # install workspaces
npm run build               # build shared/pipeline/player-core/api (required before test/dev)
npm run dev                 # web app at http://localhost:5173
npm run api                 # backend at http://127.0.0.1:5174 (separate terminal)
npm test                    # run the test suite (builds first via pretest)
npm run typecheck

# enrich a subtitle file into Episode JSON by hand (the API does this server-side)
npm run enrich -- packages/pipeline/samples/eki-de.ja.srt \
  --en packages/pipeline/samples/eki-de.en.srt --pretty \
  --out "$(pwd)/packages/web/public/episodes/eki-de.json"
```

With the API running, the home page serves the catalog from the database
(seeded from `public/episodes/index.json` on first boot) and lets you paste any
YouTube URL: known videos play instantly; new ones probe **YouTube's own captions**
first (one-click enrich when Japanese tracks exist), then fall back to the Jimaku
picker. Server requirements:

- **`yt-dlp`** on `PATH` (or set `YT_DLP_BIN`) — fetches creator/auto captions
  server-side. Install: `brew install yt-dlp`
- **`JIMAKU_API_KEY`** (from your [jimaku.cc](https://jimaku.cc) account page) —
  only needed for the Jimaku fallback when YouTube has no Japanese captions

Without the API, the web app falls back to the static manifest.

Fine-tune subtitle drift with the in-player **sync** slider — the tuned offset
is saved to the catalog (`PATCH /api/episodes/:id`) and to `localStorage`.

## Stack

React (web) + React Native/Expo (iOS) with shared TypeScript logic;
Node/TypeScript + Postgres backend. Subtitles from [Jimaku](https://jimaku.cc),
glosses from [jmdict-simplified](https://github.com/scriptin/jmdict-simplified).

## Roadmap

1. ✅ Subtitle enrichment pipeline
2. ✅ Web immersion player (Vite + React) with swappable player adapter
3. ✅ YouTube IFrame adapter + subtitle sync (bind a `youtubeVideoId` per episode)
4. Backend API: enrich + serve episodes from Postgres ← next
5. Auth + per-user decks
6. Persist deck to Postgres + FSRS scheduling
7. iOS via Expo
