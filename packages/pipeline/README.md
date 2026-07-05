# @joylingo/pipeline

Backend enrichment pipeline — the core of JoyLingo.

```
fetch .srt/.ass (Jimaku)  →  parse  →  kuromoji tokenize  →  JMdict gloss  →  Episode JSON
```

The client never tokenizes Japanese. It renders the pre-enriched `Episode` JSON
whose shape is defined in [`@joylingo/shared`](../shared/src/index.ts) and
matches the prototype (`immersion_player_prototype.jsx`).

## Setup

```bash
npm install                 # from the repo root
npm run download-jmdict     # fetch the JMdict common-words subset (~15 MB) into data/
# or:  npm run download-jmdict -- --full   for the complete JMdict
```

`download-jmdict` pulls the latest release from
[scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified) and
extracts the JSON into `packages/pipeline/data/` (git-ignored). The pipeline
auto-discovers it; without it, enrichment still runs but glosses are `null`.

## CLI

```bash
# from packages/pipeline
npx tsx src/cli.ts samples/eki-de.ja.srt \
  --en samples/eki-de.en.srt \
  --title "駅で" --title-en "At the Station" \
  --pretty --out episode.json
```

| flag | meaning |
| --- | --- |
| `--en <file>` | English subtitle track, aligned onto the JP lines by time overlap |
| `--out <file>` | write JSON here (default: stdout) |
| `--title`, `--title-en` | episode titles |
| `--jmdict <file>` | explicit jmdict-simplified JSON (else auto-discovered in `data/`) |
| `--pretty` | pretty-print |

## Library

```ts
import { enrichEpisode, resolveGlossProvider } from "@joylingo/pipeline";

const gloss = await resolveGlossProvider();          // JMdict, or null provider
const episode = await enrichEpisode(srtText, {
  format: "srt",
  gloss,
  english: { content: enSrtText },
  title: "駅で",
});
```

## How it works

- **Parsing** (`src/parse/`) — hand-written `.srt`/`.vtt` and `.ass` parsers
  normalize everything to `{ start, end, text }` cues with markup stripped.
- **Tokenizing** (`src/tokenize/`) — kuromoji + IPADIC. IPADIC over-segments
  (来た → 来 + た), so we **regroup** a verb/adjective stem with its trailing
  inflectional pieces into one clickable word carrying its dictionary form
  (来た → one token, `dict: 来る`, `r: きた`). Kuromoji's Japanese POS is mapped
  down to a small display set (`noun`, `verb`, `particle`, …). Readings are
  converted katakana → hiragana and only attached when the surface has kanji.
- **Glossing** (`src/gloss/`) — a `GlossProvider` interface. `JmdictGlossProvider`
  indexes every kanji/kana spelling and picks the sense whose POS matches the
  token, so homographs resolve sensibly.
- **English alignment** (`src/align/`) — overlaps each JP line with the English
  cues by time and joins them; no shared cue boundaries required.

## Known limitations / next

- **Noun compounds are not merged.** Verb/adjective inflections are regrouped,
  but a compound like 十分後 tokenizes as 十 / 分 / 後 (each glossed
  individually) rather than one unit. Bunsetsu-level chunking is a deliberate
  follow-up — the current rule set is conservative to avoid over-merging (e.g.
  name + さん).
- Timing offsets between subtitle and video release are out of scope here; fix
  upstream with ffsubsync/alass before enrichment.
- Next step per the roadmap: persist the deck to Postgres and wire FSRS.
