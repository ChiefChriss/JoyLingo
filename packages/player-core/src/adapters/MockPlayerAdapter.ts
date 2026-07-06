import type { PlayerAdapter } from "../PlayerAdapter.js";

/**
 * A wall-clock player for episodes with no bound video source. Drives the
 * same PlayerAdapter interface the YouTube adapter implements, so the UI
 * is identical either way.
 */
export class MockPlayerAdapter implements PlayerAdapter {
  private time = 0;
  private playing = false;
  private lastTick = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeSubs = new Set<(t: number) => void>();
  private stateSubs = new Set<(playing: boolean) => void>();

  constructor(private duration: number) {}

  getCurrentTime(): number {
    return this.time;
  }

  getDuration(): number {
    return this.duration;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  seek(seconds: number): void {
    this.time = Math.min(this.duration, Math.max(0, seconds));
    this.emitTime();
  }

  play(): void {
    if (this.playing) return;
    if (this.time >= this.duration) this.time = 0;
    this.playing = true;
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), 50);
    this.emitState();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.emitState();
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
    this.pause();
    this.timeSubs.clear();
    this.stateSubs.clear();
  }

  private tick(): void {
    const now = performance.now();
    this.time += (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.pause();
    }
    this.emitTime();
  }

  private emitTime(): void {
    for (const cb of this.timeSubs) cb(this.time);
  }

  private emitState(): void {
    for (const cb of this.stateSubs) cb(this.playing);
  }
}
