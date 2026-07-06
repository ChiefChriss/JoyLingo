import type { SourceEntry, VideoLink } from "./types.js";
import { decodeProviderId } from "./crypto.js";

const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";
const REFERER = "https://youtu-chan.com";
const PROVIDER_BASE = "https://allanime.day";

function firstMatch(s: string, pattern: RegExp): string | null {
  const m = s.match(pattern);
  return m?.[1] ?? null;
}

function expandWixmp(link: string, name: string, referer: string): VideoLink[] {
  let base = link.replace("repackager.wixmp.com/", "");
  const urlsetIdx = base.indexOf(".urlset");
  if (urlsetIdx >= 0) base = base.slice(0, urlsetIdx);

  const qualityCSV = firstMatch(base, /\/,([^/]*),\/mp4/);
  if (!qualityCSV) {
    return [{ quality: "auto", url: link, referer, providerName: name }];
  }

  const segment = `/,${qualityCSV},/mp4`;
  const out: VideoLink[] = [];
  for (const quality of qualityCSV.split(",").filter(Boolean)) {
    const direct = base.replace(segment, `/${quality}/mp4`);
    out.push({ quality, url: direct, referer, providerName: name });
  }
  return out;
}

function parseClock(data: unknown, name: string, referer: string): VideoLink[] {
  if (!data || typeof data !== "object") return [];
  const json = data as Record<string, unknown>;
  const linkObjs = json.links as Record<string, unknown>[] | undefined;
  if (!linkObjs) return [];

  const out: VideoLink[] = [];
  for (const obj of linkObjs) {
    const urlString = (obj.link ?? obj.src) as string | undefined;
    if (!urlString) continue;

    if (urlString.includes("repackager.wixmp.com")) {
      out.push(...expandWixmp(urlString, name, referer));
      continue;
    }

    const resolution =
      (obj.resolutionStr as string) ?? (name.toLowerCase().includes("yt") ? "Yt" : "auto");
    out.push({ quality: resolution, url: urlString, referer, providerName: name });
  }
  return out;
}

async function extractMp4Upload(embed: string, name: string): Promise<VideoLink[]> {
  const res = await fetch(embed, {
    headers: { Referer: "https://www.mp4upload.com" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const src = firstMatch(html, /src:\s*"([^"]+\.mp4[^"]*)"/);
  if (!src) return [];
  return [
    {
      quality: "mp4upload",
      url: src,
      referer: "https://www.mp4upload.com",
      providerName: name,
    },
  ];
}

export async function extractSource(entry: SourceEntry): Promise<VideoLink[]> {
  if (!entry.url.startsWith("--")) {
    if (entry.url.includes("tools.fast4speed.rsvp")) {
      return [{ quality: "Yt", url: entry.url, referer: REFERER, providerName: entry.name }];
    }
    if (entry.url.includes("mp4upload")) {
      return extractMp4Upload(entry.url, entry.name);
    }
    return [];
  }

  const path = decodeProviderId(entry.url);
  if (!path) return [];

  const clockURL = `${PROVIDER_BASE}${path}`;
  const res = await fetch(clockURL, {
    headers: { "User-Agent": AGENT, Referer: REFERER, Origin: REFERER },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return parseClock(data, entry.name, REFERER);
}

export { AGENT, REFERER, PROVIDER_BASE };
