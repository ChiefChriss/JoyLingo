import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JmdictGlossProvider } from "./jmdict.js";
import { nullGlossProvider, type GlossProvider } from "./provider.js";

export type { GlossProvider } from "./provider.js";
export { nullGlossProvider } from "./provider.js";
export { JmdictGlossProvider } from "./jmdict.js";

/** Default location the download script writes JMdict JSON to. */
export const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../data/", import.meta.url));

export interface ResolveGlossOptions {
  /** Explicit path to a jmdict-simplified JSON file. */
  jmdictPath?: string;
  /** Directory to auto-discover a `jmdict-eng*.json` file in. */
  dataDir?: string;
}

/**
 * Resolve a gloss provider: use an explicit file, else auto-discover a JMdict
 * JSON in the data dir, else fall back to the null provider (glosses become
 * null but the pipeline still produces valid output).
 */
export async function resolveGlossProvider(
  opts: ResolveGlossOptions = {}
): Promise<GlossProvider> {
  const explicit = opts.jmdictPath;
  if (explicit) return JmdictGlossProvider.load(explicit);

  const dir = opts.dataDir ?? DEFAULT_DATA_DIR;
  const found = await findJmdictFile(dir);
  if (found) return JmdictGlossProvider.load(found);

  return nullGlossProvider;
}

async function findJmdictFile(dir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null; // data dir doesn't exist yet
  }
  const match = entries
    .filter((f) => /^jmdict.*\.json$/i.test(f))
    .sort()
    .pop();
  return match ? path.join(dir, match) : null;
}
