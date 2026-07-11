/** Required speaking stage: record + playback + checklist. */
import { useCallback, useEffect, useRef, useState } from "react";
import { SPEAK_MIN_DURATION_RATIO } from "@joylingo/shared";

interface Props {
  prompt: string;
  speakSeconds?: number;
  checklist: string[];
  onComplete: (durationSec: number) => void;
}

export function SpeakPrompt({
  prompt,
  speakSeconds = 25,
  checklist,
  onComplete,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [playedBack, setPlayedBack] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timerRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [url]);

  const minDur = speakSeconds * SPEAK_MIN_DURATION_RATIO;

  const start = useCallback(async () => {
    setError(null);
    setPlayedBack(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(blob));
        const dur = (Date.now() - startedAt.current) / 1000;
        setDurationSec(dur);
        if (timerRef.current) window.clearInterval(timerRef.current);
        setRecording(false);
      };
      mediaRef.current = rec;
      startedAt.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startedAt.current) / 1000);
      }, 200);
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone permission is required for the speaking stage.");
    }
  }, [url]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
  }, []);

  const allChecked = checklist.every((c) => checked[c]);
  const longEnough = durationSec >= minDur;
  const canSubmit = Boolean(url) && playedBack && allChecked && longEnough;

  return (
    <div className="ip-speak-prompt">
      <p className="ip-section-practice-prompt">{prompt}</p>
      <p className="ip-paste-hint">
        Target ~{speakSeconds}s (minimum {Math.ceil(minDur)}s). Record, play back, then confirm
        checklist.
      </p>

      <div className="ip-speak-controls">
        {!recording && (
          <button type="button" className="btn-primary" onClick={() => void start()}>
            {url ? "Re-record" : "● Start recording"}
          </button>
        )}
        {recording && (
          <button type="button" className="btn-secondary" onClick={stop}>
            ■ Stop ({elapsed.toFixed(0)}s)
          </button>
        )}
      </div>

      {url && (
        <audio
          className="ip-speak-audio"
          src={url}
          controls
          onPlay={() => setPlayedBack(true)}
        />
      )}

      {url && !longEnough && (
        <p className="ip-error">
          Recording too short ({durationSec.toFixed(1)}s). Need at least {Math.ceil(minDur)}s.
        </p>
      )}

      {error && <div className="ip-error">{error}</div>}

      <ul className="ip-speak-checklist">
        {checklist.map((c) => (
          <li key={c}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(checked[c])}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [c]: e.target.checked }))
                }
              />{" "}
              {c}
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-primary"
        disabled={!canSubmit}
        onClick={() => onComplete(durationSec)}
      >
        Submit speaking stage
      </button>
    </div>
  );
}
