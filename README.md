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
| `immersion_player_prototype.jsx` | React prototype of the player UI (mock clock) |

## Quick start

```bash
npm install                 # install workspaces
npm run download-jmdict     # fetch the JMdict dictionary (~15 MB) into pipeline/data/
npm test                    # run the test suite
npm run typecheck

# enrich a subtitle file into Episode JSON
cd packages/pipeline
npx tsx src/cli.ts samples/eki-de.ja.srt --en samples/eki-de.en.srt --pretty --out episode.json
```

## Stack

React (web) + React Native/Expo (iOS) with shared TypeScript logic;
Node/TypeScript + Postgres backend. Subtitles from [Jimaku](https://jimaku.cc),
glosses from [jmdict-simplified](https://github.com/scriptin/jmdict-simplified).

## Roadmap

1. Real YouTube IFrame player + subtitle sync ← next
2. ✅ Subtitle enrichment pipeline
3. Persist deck to Postgres + FSRS scheduling
