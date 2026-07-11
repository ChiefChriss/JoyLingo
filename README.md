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
npm run sidecar             # stream sidecar at http://127.0.0.1:8000 (separate terminal)
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

- **Python stream sidecar** for anime playback — run
  `python3 -m pip install -r sidecar/requirements.txt`, then `npm run sidecar`.
  It uses Chrome TLS impersonation for Miruro and rewrites HLS playlists through
  JoyLingo's same-origin `/api/proxy`.
- **`yt-dlp`** on `PATH` (or set `YT_DLP_BIN`) — fetches creator/auto captions
  server-side. Install: `brew install yt-dlp`
- **`JIMAKU_API_KEY`** (from your [jimaku.cc](https://jimaku.cc) account page) —
  only needed for the Jimaku fallback when YouTube has no Japanese captions

Without the API, the web app falls back to the static manifest.

Fine-tune subtitle drift with the in-player **sync** slider — the tuned offset
is saved to the catalog (`PATCH /api/episodes/:id`) and to `localStorage`.

## AI curriculum teacher (local-dev first)

The lesson teacher is **off in production by default**. Use it personally against
your local API before enabling anything on Railway/Vercel.

1. In `packages/api/.env`:
   ```bash
   TEACHER_ENABLED=true
   OPENROUTER_API_KEY=sk-or-...
   # optional:
   # OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
   ```
2. In `packages/web/.env.local` (gitignored):
   ```bash
   VITE_TEACHER_ENABLED=true
   # Hugging Face speech-to-speech (EN↔JA voice) — see below
   VITE_TEACHER_S2S_URL=ws://127.0.0.1:8765/v1/realtime
   # optional browser TTS for text replies:
   # VITE_TEACHER_VOICE=true
   # VITE_TEACHER_TTS_URL=http://127.0.0.1:8020/tts
   ```
3. Restart `npm run api` and `npm run dev`, open a curriculum lesson — **Ask teacher** appears.
4. Keep `TEACHER_ENABLED` / `VITE_TEACHER_ENABLED` unset on Railway and Vercel until you choose to ship text. Leave voice flags off in prod.

### Voice mode (Hugging Face speech-to-speech)

Browser dictation is English-biased and bad at mid-sentence EN↔JA switching.
JoyLingo’s **Voice (HF S2S)** button talks to a local
[speech-to-speech](https://github.com/huggingface/speech-to-speech) realtime
server (VAD → Whisper STT → OpenRouter LLM → Qwen3 TTS) over the OpenAI
Realtime WebSocket protocol.

1. Install is handled by the launcher (Python 3.11–3.13). On first run:
   ```bash
   npm run teacher:s2s
   ```
   creates `.venv-s2s/` and installs [speech-to-speech](https://github.com/huggingface/speech-to-speech).
2. The sidecar uses **mlx-audio Whisper** on Mac (or Faster Whisper elsewhere) with
   `--language auto` so EN↔JA switching works. Do **not** use default Parakeet STT
   (EU languages only). Default STT is full `mlx-community/whisper-large-v3-mlx`
   (better JP / code-switch than turbo). Override with `TEACHER_S2S_STT_MODEL`
   (e.g. `…-turbo` for speed).
3. Ensure `VITE_TEACHER_S2S_URL=ws://127.0.0.1:8765/v1/realtime` in `.env.local`,
   restart Vite, open a lesson → **Voice (HF S2S)**.

The launcher waits ≈2.8s of silence before ending your turn (live transcription
off, so a pause after “okay…” doesn’t finalize early). If it still cuts you off,
raise `TEACHER_S2S_MIN_SILENCE_MS` (e.g. `3500`) in `packages/api/.env` and
restart `npm run teacher:s2s`.

Voice LLM calls go through the JoyLingo API (`/api/teacher/llm/v1/responses`),
which uses the **same model** as the teacher panel selector. Keep `npm run api`
running while using voice.

First launch downloads STT/TTS weights (multi‑GB) and can take a while.

### Hearing pronunciation (text chat)

- **Listen** on a teacher reply reads the answer aloud with the browser’s
  speechSynthesis (English + Japanese chunks). Optional **Auto-listen** plays
  each new reply automatically.
- **Speak JP** / **Speak slowly** (when `VITE_TEACHER_VOICE=true`) uses a local
  `ja-JP` browser voice to pronounce kana at study speed.
- **Hear in anime** plays the existing short clip around that word, so you hear
  natural timing and intonation in context.

The teacher explains mora (“beats”) by splitting readings, including `ん`, small
`っ`, and long vowels, then provides a kana-only line for the Speak button.
For a better local Japanese voice, set `VITE_TEACHER_TTS_URL` to a VoiceVox- or
Piper-compatible adapter that accepts `POST { text, lang, rate }` and returns
audio. Browser TTS remains the fallback.

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
