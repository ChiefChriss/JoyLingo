/**
 * Thin Jimaku (jimaku.cc) API client. Requires an API key — generate one on
 * your Jimaku account page and set JIMAKU_API_KEY. The backend proxies search
 * and downloads so the key never reaches the browser.
 */
import { decodeSubtitleBytes } from "./text-sanitize.js";
import { filterJimakuSubtitleFiles, isArchiveFile } from "./jimaku-files.js";

const BASE = process.env.JIMAKU_API_BASE ?? "https://jimaku.cc";

export interface JimakuEntry {
  id: number;
  name: string;
  english_name: string | null;
  japanese_name: string | null;
  anilist_id: number | null;
}

export interface JimakuFile {
  url: string;
  name: string;
  size: number;
  last_modified: string;
}

export class JimakuError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.JIMAKU_API_KEY;
  if (!key) {
    throw new JimakuError(
      "JIMAKU_API_KEY is not set — generate a key at jimaku.cc (account page) and restart the API",
      503,
    );
  }
  return key;
}

async function jimakuFetch(path: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: apiKey() },
  });
  if (res.status === 429) {
    throw new JimakuError("Jimaku rate limit hit — try again in a few seconds", 429);
  }
  if (!res.ok) {
    throw new JimakuError(`Jimaku request failed (${res.status})`, 502);
  }
  return res;
}

export async function searchEntries(query: string): Promise<JimakuEntry[]> {
  const res = await jimakuFetch(
    `/api/entries/search?query=${encodeURIComponent(query)}&anime=true`,
  );
  return (await res.json()) as JimakuEntry[];
}

export async function listFiles(entryId: number): Promise<JimakuFile[]> {
  const res = await jimakuFetch(`/api/entries/${entryId}/files`);
  return (await res.json()) as JimakuFile[];
}

/**
 * List individual subtitle tracks for an entry. Jimaku's `?episode=` filter
 * often returns bulk .zip/.7z archives only — we scan the full file list and
 * match filenames like `第178話` or `- 178` instead.
 */
export async function listSubtitleFiles(
  entryId: number,
  episode?: number,
): Promise<JimakuFile[]> {
  const all = await listFiles(entryId);
  return filterJimakuSubtitleFiles(all, episode);
}

/** Download a subtitle file listed by the files endpoint. */
export async function downloadFile(url: string, filename?: string): Promise<string> {
  if (filename && isArchiveFile(filename)) {
    throw new JimakuError(
      "Pick a single .srt or .ass subtitle file — not a .zip/.7z archive",
      400,
    );
  }
  const res = await fetch(url, { headers: { Authorization: apiKey() } });
  if (!res.ok) throw new JimakuError(`Jimaku file download failed (${res.status})`, 502);
  const buf = Buffer.from(await res.arrayBuffer());
  // Zip local-file header — catches mislabeled archives.
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    throw new JimakuError(
      "Downloaded file is a zip archive — pick an individual .srt or .ass track",
      400,
    );
  }
  return decodeSubtitleBytes(buf);
}
