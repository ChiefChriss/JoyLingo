/**
 * YouTube caption discovery + download via yt-dlp (must be on PATH, or set
 * YT_DLP_BIN). Server-side only — the binary and any cookies never touch the
 * browser. Manual (creator) tracks are preferred over auto-generated ones.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const YT_DLP = process.env.YT_DLP_BIN ?? "yt-dlp";
const LIST_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export class YoutubeCaptionsError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
  }
}

export class YtDlpNotInstalledError extends YoutubeCaptionsError {
  constructor() {
    super(
      "yt-dlp is not installed on the server — install it (brew install yt-dlp) or set YT_DLP_BIN",
      503,
    );
  }
}

export class NoJapaneseCaptionsError extends YoutubeCaptionsError {
  constructor() {
    super("This video has no Japanese captions on YouTube", 404);
  }
}

export interface CaptionTrack {
  /** yt-dlp language key, e.g. "ja", "ja-orig", "en-US". */
  lang: string;
  /** Human label from yt-dlp, e.g. "Japanese (Original)". */
  name: string;
  /** false → creator-uploaded ("manual"), true → auto-generated. */
  auto: boolean;
}

export interface CaptionTracks {
  videoId: string;
  title: string;
  tracks: CaptionTrack[];
  recommended: { ja: CaptionTrack | null; en: CaptionTrack | null };
}

interface YtDlpTrackFormat {
  ext?: string;
  name?: string;
}

interface YtDlpJson {
  title?: string;
  subtitles?: Record<string, YtDlpTrackFormat[]>;
  automatic_captions?: Record<string, YtDlpTrackFormat[]>;
}

function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function runYtDlp(args: string[], timeout: number): Promise<string> {
  try {
    const { stdout } = await execFileP(YT_DLP, ["--no-update", ...args], {
      timeout,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (e.code === "ENOENT") throw new YtDlpNotInstalledError();
    if (e.killed) throw new YoutubeCaptionsError("yt-dlp timed out", 504);
    const stderr = (e.stderr ?? "").split("\n").find((l) => l.includes("ERROR")) ?? "";
    throw new YoutubeCaptionsError(
      `yt-dlp failed${stderr ? `: ${stderr.replace(/^ERROR:\s*/, "")}` : ""}`,
    );
  }
}

function toTracks(map: Record<string, YtDlpTrackFormat[]> | undefined, auto: boolean): CaptionTrack[] {
  return Object.entries(map ?? {}).map(([lang, formats]) => ({
    lang,
    name: formats.find((f) => f.name)?.name ?? lang,
    auto,
  }));
}

/**
 * Auto-caption keys like "ja-en" mean "Japanese translated from English" —
 * machine-translated, not what a learner should read. Accept only original
 * Japanese: manual ja*, or auto "ja"/"ja-orig".
 */
const MANUAL_JA_PRIORITY = ["ja", "ja-orig", "ja-JP"];
const AUTO_JA_PRIORITY = ["ja-orig", "ja"];
const MANUAL_EN_PRIORITY = ["en", "en-US", "en-GB"];
const AUTO_EN_PRIORITY = ["en-orig", "en"];

function pick(tracks: CaptionTrack[], manualPriority: string[], autoPriority: string[]): CaptionTrack | null {
  for (const lang of manualPriority) {
    const t = tracks.find((t) => !t.auto && t.lang === lang);
    if (t) return t;
  }
  // Any other manual track in the family (e.g. an unusual "ja-x" key).
  const family = manualPriority[0]!;
  const manual = tracks.find((t) => !t.auto && t.lang.startsWith(family));
  if (manual) return manual;
  for (const lang of autoPriority) {
    const t = tracks.find((t) => t.auto && t.lang === lang);
    if (t) return t;
  }
  return null;
}

export function pickBestJaTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  return pick(tracks, MANUAL_JA_PRIORITY, AUTO_JA_PRIORITY);
}

export function pickBestEnTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  return pick(tracks, MANUAL_EN_PRIORITY, AUTO_EN_PRIORITY);
}

/** Parse a yt-dlp -j payload into caption tracks (exported for tests). */
export function parseCaptionTracks(videoId: string, json: YtDlpJson): CaptionTracks {
  // Auto captions exist in ~150 translated languages; only the ja/en families
  // matter here, so drop the rest before it hits the wire.
  const tracks = [
    ...toTracks(json.subtitles, false),
    ...toTracks(json.automatic_captions, true),
  ].filter((t) => t.lang.startsWith("ja") || t.lang.startsWith("en"));
  return {
    videoId,
    title: json.title ?? "",
    tracks,
    recommended: { ja: pickBestJaTrack(tracks), en: pickBestEnTrack(tracks) },
  };
}

export async function listCaptionTracks(videoId: string): Promise<CaptionTracks> {
  const stdout = await runYtDlp(["-j", "--skip-download", videoUrl(videoId)], LIST_TIMEOUT_MS);
  return parseCaptionTracks(videoId, JSON.parse(stdout) as YtDlpJson);
}

export interface DownloadedCaptions {
  title: string;
  ja: { filename: string; content: string };
  en?: { filename: string; content: string };
}

/**
 * Download the given tracks as SRT. ja and en tracks may differ in kind
 * (manual vs auto), so each is fetched with the matching yt-dlp flag.
 */
export async function downloadCaptions(
  videoId: string,
  ja: CaptionTrack,
  en?: CaptionTrack | null,
): Promise<DownloadedCaptions> {
  const dir = await mkdtemp(path.join(tmpdir(), `joylingo-${videoId}-`));
  try {
    const wanted: CaptionTrack[] = en ? [ja, en] : [ja];
    for (const kind of [false, true]) {
      const langs = wanted.filter((t) => t.auto === kind).map((t) => t.lang);
      if (langs.length === 0) continue;
      await runYtDlp(
        [
          kind ? "--write-auto-subs" : "--write-subs",
          "--sub-langs",
          langs.join(","),
          "--convert-subs",
          "srt",
          "--skip-download",
          "-o",
          path.join(dir, "captions.%(ext)s"),
          videoUrl(videoId),
        ],
        DOWNLOAD_TIMEOUT_MS,
      );
    }

    const files = await readdir(dir);
    const readTrack = async (track: CaptionTrack) => {
      const file = files.find((f) => f === `captions.${track.lang}.srt`);
      if (!file) return null;
      return {
        filename: `youtube.${track.lang}.srt`,
        content: await readFile(path.join(dir, file), "utf8"),
      };
    };

    const jaResult = await readTrack(ja);
    if (!jaResult) throw new NoJapaneseCaptionsError();
    const enResult = en ? await readTrack(en) : null;

    return { title: "", ja: jaResult, ...(enResult ? { en: enResult } : {}) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
