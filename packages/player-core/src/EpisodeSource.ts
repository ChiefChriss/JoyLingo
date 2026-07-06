/**
 * Binding between an enriched Episode JSON and where its video lives.
 * Served by the backend catalog (GET /api/episodes); the static manifest in
 * public/episodes/ carries the same shape as a dev fallback.
 */
export interface AnimeStreamBinding {
  malId: number;
  showId: string;
  episode: string;
  mode: "sub" | "dub";
}

export interface EpisodeSource {
  episodeId: string;
  title: string;
  titleEn: string | null;
  /** URL of the enriched Episode JSON. */
  file: string;
  /** null → no bound video; the mock clock drives playback. */
  youtubeVideoId: string | null;
  /** Anime stream binding — CDN URLs are re-resolved on each watch. */
  animeStream?: AnimeStreamBinding | null;
  /** Seconds to shift subtitles if they drift from the video. */
  subtitleOffset?: number;
  /** Curated "start here" recommendation (set by the backend catalog). */
  featured?: boolean;
}
