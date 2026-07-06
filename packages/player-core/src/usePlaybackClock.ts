import { useEffect, useState } from "react";
import type { PlayerAdapter } from "./PlayerAdapter.js";

export interface PlaybackClock {
  currentTime: number;
  playing: boolean;
  duration: number;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(seconds: number): void;
}

/**
 * Bridge a PlayerAdapter into React state. Accepts null while the adapter
 * is being constructed (e.g. waiting for the YouTube IFrame mount).
 */
export function usePlaybackClock(adapter: PlayerAdapter | null): PlaybackClock {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!adapter) return;
    setCurrentTime(adapter.getCurrentTime());
    setPlaying(adapter.isPlaying());
    setDuration(adapter.getDuration());
    const offTime = adapter.onTimeUpdate((t) => {
      setCurrentTime(t);
      // YouTube reports duration only after the player is ready; refresh here.
      setDuration(adapter.getDuration());
    });
    const offState = adapter.onStateChange(setPlaying);
    return () => {
      offTime();
      offState();
    };
  }, [adapter]);

  return {
    currentTime,
    playing,
    duration,
    play: () => adapter?.play(),
    pause: () => adapter?.pause(),
    toggle: () => (adapter?.isPlaying() ? adapter.pause() : adapter?.play()),
    seek: (seconds: number) => adapter?.seek(seconds),
  };
}
