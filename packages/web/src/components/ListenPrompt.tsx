/** TTS / optional audio listening prompt for school-grade stages. */
import { useCallback, useRef, useState } from "react";

interface Props {
  promptJa: string;
  audioUrl?: string;
  maxReplays?: number;
  onPlayed?: () => void;
}

export function ListenPrompt({
  promptJa,
  audioUrl,
  maxReplays = 2,
  onPlayed,
}: Props) {
  const [plays, setPlays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakTts = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Speech synthesis unavailable in this browser.");
      return false;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(promptJa);
    u.lang = "ja-JP";
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const ja = voices.find((v) => v.lang.startsWith("ja"));
    if (ja) u.voice = ja;
    u.onend = () => setPlaying(false);
    u.onerror = () => {
      setPlaying(false);
      setError("Could not play Japanese TTS. Check system voices.");
    };
    setPlaying(true);
    window.speechSynthesis.speak(u);
    return true;
  }, [promptJa]);

  const play = useCallback(() => {
    if (plays > maxReplays) return;
    setError(null);
    if (audioUrl) {
      const el = audioRef.current ?? new Audio(audioUrl);
      audioRef.current = el;
      el.onended = () => setPlaying(false);
      setPlaying(true);
      void el.play().catch(() => {
        setPlaying(false);
        if (!speakTts()) setError("Audio failed.");
      });
    } else if (!speakTts()) {
      return;
    }
    setPlays((p) => p + 1);
    onPlayed?.();
  }, [audioUrl, maxReplays, onPlayed, plays, speakTts]);

  const remaining = Math.max(0, maxReplays + 1 - plays);

  return (
    <div className="ip-listen-prompt">
      <p className="ip-paste-hint">Listen carefully (transcript hidden until you miss).</p>
      <button
        type="button"
        className="btn-primary"
        onClick={play}
        disabled={playing || remaining <= 0}
      >
        {playing ? "Playing…" : plays === 0 ? "▶ Play audio" : `▶ Replay (${remaining} left)`}
      </button>
      {error && <div className="ip-error" style={{ marginTop: 8 }}>{error}</div>}
      {remaining <= 0 && (
        <p className="ip-paste-hint">No replays left — answer from memory.</p>
      )}
    </div>
  );
}
