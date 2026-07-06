/**
 * YouTube metadata via oEmbed — no API key, enough for pre-filling the Jimaku
 * search (title + channel). Swap for the Data API if duration is ever needed.
 */

export interface YoutubeMetadata {
  videoId: string;
  title: string;
  channel: string;
}

const VIDEO_ID_RE = /^[\w-]{11}$/;

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id);
}

export async function fetchYoutubeMetadata(videoId: string): Promise<YoutubeMetadata | null> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null; // 404/401 → video missing or embed-restricted
  const data = (await res.json()) as { title?: string; author_name?: string };
  return {
    videoId,
    title: data.title ?? "",
    channel: data.author_name ?? "",
  };
}
