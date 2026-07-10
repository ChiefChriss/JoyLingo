/**
 * The swappable player contract. Everything below the player (subtitle sync,
 * lookup, deck) consumes only `currentTime` — it never cares where video
 * comes from. Implementations: MockPlayerAdapter (demo clock),
 * YouTubePlayerAdapter (IFrame API), HtmlVideoPlayerAdapter (proxied anime
 * streams or local `blob:` files). A browser-extension overlay remains future work.
 */
export interface PlayerAdapter {
  getCurrentTime(): number;
  seek(seconds: number): void;
  play(): void;
  pause(): void;
  getDuration(): number;
  isPlaying(): boolean;
  /** Subscribe to time ticks (~4x/sec or better). Returns unsubscribe. */
  onTimeUpdate(cb: (t: number) => void): () => void;
  /** Subscribe to play/pause transitions. Returns unsubscribe. */
  onStateChange(cb: (playing: boolean) => void): () => void;
  /** Tear down timers / embedded players. */
  destroy(): void;
}
