/**
 * Download the JMdict dictionary used for gloss enrichment.
 *
 *   npm run download-jmdict            # common-words subset (smaller, default)
 *   npm run download-jmdict -- --full  # full JMdict English
 *
 * Fetches the latest release from scriptin/jmdict-simplified, extracts the
 * single JSON out of the `.json.tgz` asset (minimal built-in tar reader, no
 * extra deps), and writes it into packages/pipeline/data/.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const RELEASE_API = "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest";

interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

async function main() {
  const full = process.argv.includes("--full");
  const wanted = full ? /^jmdict-eng-\d.*\.json\.tgz$/ : /^jmdict-eng-common.*\.json\.tgz$/;

  console.log(`Fetching latest jmdict-simplified release…`);
  const release = (await fetchJson(RELEASE_API)) as { tag_name: string; assets: GithubAsset[] };
  console.log(`  release: ${release.tag_name}`);

  const asset =
    release.assets.find((a) => wanted.test(a.name)) ??
    release.assets.find((a) => /^jmdict-eng.*\.json\.tgz$/.test(a.name));
  if (!asset) {
    throw new Error(
      `No matching .json.tgz asset found. Available: ${release.assets.map((a) => a.name).join(", ")}`
    );
  }

  const mb = (asset.size / 1024 / 1024).toFixed(1);
  console.log(`  downloading ${asset.name} (${mb} MB compressed)…`);
  const tgz = Buffer.from(await fetchBuffer(asset.browser_download_url));

  console.log(`  extracting…`);
  const { name, content } = extractSingleJsonFromTgz(tgz);

  await mkdir(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, name);
  await writeFile(outPath, content);
  console.log(`✓ wrote ${outPath} (${(content.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  the pipeline will auto-discover it on the next enrich run.`);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": "joylingo-pipeline", Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: { "User-Agent": "joylingo-pipeline" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}

/**
 * Extract the first `.json` file from a gzipped tar (`.tgz`). Handles the ustar
 * format well enough for jmdict-simplified's single-entry archives.
 */
function extractSingleJsonFromTgz(tgz: Buffer): { name: string; content: Buffer } {
  const tar = gunzipSync(tgz);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    // An all-zero block marks end of archive.
    if (header.every((b) => b === 0)) break;

    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "").trim();
    const sizeOctal = header.toString("utf8", 124, 136).replace(/\0.*$/, "").trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const dataStart = offset + 512;

    if (/\.json$/i.test(name)) {
      const content = tar.subarray(dataStart, dataStart + size);
      return { name: path.basename(name), content };
    }
    // Advance past this entry's data, padded up to the next 512 boundary.
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  throw new Error("No .json entry found inside the .tgz archive");
}

main().catch((err) => {
  console.error("✗ download-jmdict failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
