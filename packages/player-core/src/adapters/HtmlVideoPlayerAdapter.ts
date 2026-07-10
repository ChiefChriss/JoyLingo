import type { PlayerAdapter } from "../PlayerAdapter.js";

const POLL_MS = 250;

/**
 * HTML5 <video> playback behind the PlayerAdapter interface. Used for
 * proxied anime streams (server handles Referer/Range) and local `blob:`
 * object URLs (set `video.src` directly — no proxy).
 *
 * Polls currentTime while playing (like YouTubePlayerAdapter) because
 * `timeupdate` alone is throttled and unreliable with native controls.
 */
export class HtmlVideoPlayerAdapter implements PlayerAdapter {
  private video: HTMLVideoElement;
  private playing = false;
  private lastTime = 0;
  private poll: ReturnType<typeof setInterval> | null = null;
  private timeSubs = new Set<(t: number) => void>();
  private stateSubs = new Set<(playing: boolean) => void>();
  private destroyed = false;

  private onTimeUpdateBound = () => this.emitTime();
  private onPlayBound = () => this.setPlaying(true);
  private onPauseBound = () => this.setPlaying(false);
  private onEndedBound = () => this.setPlaying(false);
  private onSeekedBound = () => this.emitTime();
  private onLoadedBound = () => this.emitTime();
  private onErrorBound = () => {
    if (!this.destroyed) this.onError?.(new Error("Video playback failed"));
  };

  constructor(
    video: HTMLVideoElement,
    private onError?: (err: Error) => void,
  ) {
    this.video = video;
    video.addEventListener("timeupdate", this.onTimeUpdateBound);
    video.addEventListener("play", this.onPlayBound);
    video.addEventListener("pause", this.onPauseBound);
    video.addEventListener("ended", this.onEndedBound);
    video.addEventListener("seeked", this.onSeekedBound);
    video.addEventListener("loadedmetadata", this.onLoadedBound);
    video.addEventListener("error", this.onErrorBound);

    this.lastTime = video.currentTime;
    this.playing = !video.paused && !video.ended;
    if (this.playing) this.startPolling();
  }

  getCurrentTime(): number {
    return this.lastTime;
  }

  getDuration(): number {
    const d = this.video.duration;
    return Number.isFinite(d) ? d : 0;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  seek(seconds: number): void {
    const d = this.getDuration();
    this.video.currentTime = d > 0 ? Math.min(d, Math.max(0, seconds)) : Math.max(0, seconds);
    this.lastTime = this.video.currentTime;
    this.emitTime();
  }

  play(): void {
    void this.video.play().catch((err: Error) => {
      if (!this.destroyed) this.onError?.(err);
    });
  }

  pause(): void {
    this.video.pause();
  }

  onTimeUpdate(cb: (t: number) => void): () => void {
    this.timeSubs.add(cb);
    cb(this.lastTime);
    return () => this.timeSubs.delete(cb);
  }

  onStateChange(cb: (playing: boolean) => void): () => void {
    this.stateSubs.add(cb);
    cb(this.playing);
    return () => this.stateSubs.delete(cb);
  }

  destroy(): void {
    this.destroyed = true;
    this.stopPolling();
    this.video.removeEventListener("timeupdate", this.onTimeUpdateBound);
    this.video.removeEventListener("play", this.onPlayBound);
    this.video.removeEventListener("pause", this.onPauseBound);
    this.video.removeEventListener("ended", this.onEndedBound);
    this.video.removeEventListener("seeked", this.onSeekedBound);
    this.video.removeEventListener("loadedmetadata", this.onLoadedBound);
    this.video.removeEventListener("error", this.onErrorBound);
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.timeSubs.clear();
    this.stateSubs.clear();
  }

  private setPlaying(next: boolean): void {
    const wasPlaying = this.playing;
    this.playing = next;
    if (next && !wasPlaying) this.startPolling();
    if (!next && wasPlaying) this.stopPolling();
    if (this.playing !== wasPlaying) this.emitState();
    this.emitTime();
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
    if (this.destroyed) return;
    this.lastTime = this.video.currentTime;
    for (const cb of this.timeSubs) cb(this.lastTime);
  }

  private emitState(): void {
    for (const cb of this.stateSubs) cb(this.playing);
  }
}
