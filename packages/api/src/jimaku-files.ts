import type { JimakuFile } from "./jimaku.js";

const SUBTITLE_EXT = /\.(ass|ssa|srt|vtt)$/i;
const ARCHIVE_EXT = /\.(zip|7z|rar|tar|gz|tgz)$/i;

export function isSubtitleFile(name: string): boolean {
  return SUBTITLE_EXT.test(name);
}

export function isArchiveFile(name: string): boolean {
  return ARCHIVE_EXT.test(name);
}

/**
 * Match Jimaku filenames to an absolute episode number.
 * Handles HorribleSubs (`- 178`), Amazon (`第178話`, `S02E048.第178話`), etc.
 */
export function matchesEpisodeFilename(name: string, episode: number): boolean {
  const n = Math.floor(episode);
  if (!Number.isFinite(n) || n <= 0) return false;

  const patterns = [
    new RegExp(`第${n}話`),
    new RegExp(`[Ee][pP]?(?:isode)?[\\s._-]*0*${n}(?:[^0-9]|$)`),
    new RegExp(`[\\s._-]0*${n}[\\s._)\\]\\[]`),
    new RegExp(`S\\d+E0*${n}\\b`, "i"),
    new RegExp(`\\[${n}\\]`),
  ];

  if (n >= 10) {
    patterns.push(new RegExp(`(?:^|[^0-9])${n}(?:[^0-9]|$)`));
  }

  return patterns.some((p) => p.test(name));
}

/** Prefer per-episode .ass/.srt over bulk/other formats. */
export function rankJimakuFile(file: JimakuFile, episode?: number): number {
  let score = 0;
  const name = file.name;
  const lower = name.toLowerCase();

  if (lower.endsWith(".ass") || lower.endsWith(".ssa")) score += 20;
  else if (lower.endsWith(".srt")) score += 15;
  else if (lower.endsWith(".vtt")) score += 8;

  if (episode !== undefined) {
    if (name.includes(`第${Math.floor(episode)}話`)) score += 100;
    else if (matchesEpisodeFilename(name, episode)) score += 40;
  }

  if (/\[sdh\]/i.test(name)) score -= 3;
  if (isArchiveFile(name)) score -= 1000;

  return score;
}

export function pickBestJimakuFile(files: JimakuFile[], episode?: number): JimakuFile | null {
  const subs = files.filter((f) => isSubtitleFile(f.name) && !isArchiveFile(f.name));
  if (subs.length === 0) return null;
  return subs.reduce((best, f) =>
    rankJimakuFile(f, episode) > rankJimakuFile(best, episode) ? f : best,
  );
}

export function filterJimakuSubtitleFiles(files: JimakuFile[], episode?: number): JimakuFile[] {
  let out = files.filter((f) => isSubtitleFile(f.name) && !isArchiveFile(f.name));
  if (episode !== undefined && Number.isFinite(episode)) {
    const matched = out.filter((f) => matchesEpisodeFilename(f.name, episode));
    if (matched.length > 0) out = matched;
  }
  return out.sort((a, b) => rankJimakuFile(b, episode) - rankJimakuFile(a, episode));
}
