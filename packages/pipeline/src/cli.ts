#!/usr/bin/env node
/**
 * joylingo-enrich — turn a Jimaku subtitle file into enriched Episode JSON.
 *
 *   joylingo-enrich <japanese.srt|ass> [options]
 *
 * Options:
 *   --en <file>        English subtitle track to align onto the lines
 *   --out <file>       Write JSON here (default: stdout)
 *   --title <text>     Episode title (Japanese)
 *   --title-en <text>  Episode title (English)
 *   --jmdict <file>    Explicit jmdict-simplified JSON (else auto-discovered)
 *   --pretty           Pretty-print the JSON
 */
import { readFile, writeFile } from "node:fs/promises";
import { enrichEpisode } from "./enrich.js";
import { formatFromFilename } from "./parse/index.js";
import { resolveGlossProvider } from "./gloss/index.js";

interface Args {
  input?: string;
  en?: string;
  out?: string;
  title?: string;
  titleEn?: string;
  jmdict?: string;
  pretty: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case "--en": args.en = argv[++i]; break;
      case "--out": args.out = argv[++i]; break;
      case "--title": args.title = argv[++i]; break;
      case "--title-en": args.titleEn = argv[++i]; break;
      case "--jmdict": args.jmdict = argv[++i]; break;
      case "--pretty": args.pretty = true; break;
      case "-h":
      case "--help": args.input = undefined; return args;
      default:
        if (!a.startsWith("-") && !args.input) args.input = a;
    }
  }
  return args;
}

const USAGE = `joylingo-enrich <japanese.srt|ass> [options]

  --en <file>        English subtitle track to align onto the lines
  --out <file>       Write JSON here (default: stdout)
  --title <text>     Episode title (Japanese)
  --title-en <text>  Episode title (English)
  --jmdict <file>    Explicit jmdict-simplified JSON (else auto-discovered in data/)
  --pretty           Pretty-print the JSON
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    process.stderr.write(USAGE);
    process.exit(args.input === undefined && process.argv.length <= 2 ? 1 : 0);
    return;
  }

  const japanese = await readFile(args.input, "utf8");
  const english = args.en
    ? { content: await readFile(args.en, "utf8"), format: formatFromFilename(args.en) }
    : undefined;

  const gloss = await resolveGlossProvider(args.jmdict ? { jmdictPath: args.jmdict } : {});
  if (gloss.id === "none") {
    process.stderr.write(
      "⚠ No JMdict found — glosses will be null. Run `npm run download-jmdict` first.\n"
    );
  }

  const episode = await enrichEpisode(japanese, {
    format: formatFromFilename(args.input),
    gloss,
    english,
    title: args.title,
    titleEn: args.titleEn,
  });

  const json = JSON.stringify(episode, null, args.pretty ? 2 : 0);
  if (args.out) {
    await writeFile(args.out, json);
    process.stderr.write(
      `✓ ${episode.lines.length} lines → ${args.out} (dict: ${episode.meta?.dictionary})\n`
    );
  } else {
    process.stdout.write(json + "\n");
  }
}

main().catch((err) => {
  process.stderr.write(`✗ enrich failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
