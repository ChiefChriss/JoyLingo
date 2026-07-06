import type { PlayerAdapter } from "../PlayerAdapter.js";

/** Minimal surface of the YouTube IFrame API we consume. */
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    mountId: string,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const POLL_MS = 250;
const API_LOAD_TIMEOUT_MS = 10_000;
const API_LOAD_POLL_MS = 200;

/**
 * Wait for the IFrame API (script tag lives in the host page's index.html).
 * Chains any pre-existing onYouTubeIframeAPIReady callback. Also polls for
 * window.YT.Player in case the ready callback already fired for someone
 * else, and rejects after a timeout so a blocked/failed script load
 * surfaces as an error instead of hanging forever.
 */
function loadIframeApi(): Promise<YTNamespace> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    let settled = false;
    const settle = (yt: YTNamespace) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      resolve(yt);
    };

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) settle(window.YT);
    };

    const pollTimer = setInterval(() => {
      if (window.YT?.Player) settle(window.YT);
    }, API_LOAD_POLL_MS);

    const timeoutTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      reject(new Error("YouTube IFrame API failed to load (timed out after 10s)"));
    }, API_LOAD_TIMEOUT_MS);
  });
}

/**
 * Real YouTube playback behind the PlayerAdapter interface. The IFrame API
 * has no timeupdate event, so we poll getCurrentTime() at ~4x/sec while
 * playing (matches the prototype's notes).
 */
export class YouTubePlayerAdapter implements PlayerAdapter {
  private player: YTPlayer | null = null;
  private ready = false;
  private playing = false;
  private lastTime = 0;
  private poll: ReturnType<typeof setInterval> | null = null;
  private timeSubs = new Set<(t: number) => void>();
  private stateSubs = new Set<(playing: boolean) => void>();
  private destroyed = false;

  /**
   * @param mountId id of an empty div the iframe replaces.
   * @param onError called when the API fails to load or playback errors.
   */
  constructor(mountId: string, videoId: string, onError?: (err: Error) => void) {
    loadIframeApi().then(
      (yt) => {
        if (this.destroyed) return;
        this.player = new yt.Player(mountId, {
          videoId,
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: () => {
              this.ready = true;
              this.emitTime();
            },
            onStateChange: (event) => {
              const wasPlaying = this.playing;
              this.playing = event.data === yt.PlayerState.PLAYING;
              if (this.playing && !wasPlaying) this.startPolling();
              if (!this.playing && wasPlaying) this.stopPolling();
              if (this.playing !== wasPlaying) this.emitState();
              this.emitTime();
            },
            onError: (event) => {
              if (this.destroyed) return;
              onError?.(new Error(`YouTube playback error (code ${event.data})`));
            },
          },
        });
      },
      (err: Error) => {
        if (this.destroyed) return;
        onError?.(err);
      },
    );
  }

  getCurrentTime(): number {
    return this.lastTime;
  }

  getDuration(): number {
    return this.ready && this.player ? this.player.getDuration() : 0;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  seek(seconds: number): void {
    if (!this.ready || !this.player) return;
    this.player.seekTo(seconds, true);
    this.lastTime = seconds;
    this.emitTime();
  }

  play(): void {
    if (this.ready) this.player?.playVideo();
  }

  pause(): void {
    if (this.ready) this.player?.pauseVideo();
  }

  onTimeUpdate(cb: (t: number) => void): () => void {
    this.timeSubs.add(cb);
    return () => this.timeSubs.delete(cb);
  }

  onStateChange(cb: (playing: boolean) => void): () => void {
    this.stateSubs.add(cb);
    return () => this.stateSubs.delete(cb);
  }

  destroy(): void {
    this.destroyed = true;
    this.stopPolling();
    this.player?.destroy();
    this.player = null;
    this.timeSubs.clear();
    this.stateSubs.clear();
  }

  private startPolling(): void {
    if (this.poll !== null) return;
    this.poll = setInterval(() => this.emitTime(), POLL_MS);
  }

  private stopPolling(): void {
    if (this.poll !== null) clearInterval(this.poll);
    this.poll = null;
  }

  private emitTime(): void {
    if (this.ready && this.player) this.lastTime = this.player.getCurrentTime();
    for (const cb of this.timeSubs) cb(this.lastTime);
  }

  private emitState(): void {
    for (const cb of this.stateSubs) cb(this.playing);
  }
}
