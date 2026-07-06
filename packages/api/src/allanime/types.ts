export type TranslationMode = "sub" | "dub";

export interface Anime {
  id: string;
  name: string;
  episodeCount: number;
  malId: number | null;
}

export interface VideoLink {
  quality: string;
  url: string;
  referer: string | null;
  providerName: string;
}

export interface SourceEntry {
  name: string;
  url: string;
}

export function resolutionValue(quality: string): number {
  const n = parseInt(quality, 10);
  if (!Number.isNaN(n)) return n;
  if (quality.toLowerCase() === "yt") return 480;
  return 0;
}
