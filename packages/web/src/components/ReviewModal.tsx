import { useState } from "react";
import type { ReviewClipRef, ReviewDeckCard } from "@joylingo/player-core";
import { navigate } from "../App";

interface Props {
  cards: ReviewDeckCard[];
  onGrade: (dict: string, good: boolean) => void;
  onClose: () => void;
  /** When set, same-episode clips replay inline instead of navigating away. */
  currentEpisodeId?: string;
  onPlayClip?: (clip: ReviewClipRef) => void;
}

export function watchClipUrl(clip: ReviewClipRef): string {
  const params = new URLSearchParams({ line: clip.lineId, autoplay: "1" });
  if (clip.clipStart != null && clip.clipEnd != null) {
    params.set("clipStart", String(clip.clipStart));
    params.set("clipEnd", String(clip.clipEnd));
  }
  return `/watch/${encodeURIComponent(clip.episodeId)}?${params.toString()}`;
}

function playClip(
  clip: ReviewClipRef,
  currentEpisodeId: string | undefined,
  onPlayClip: Props["onPlayClip"],
): void {
  if (currentEpisodeId && clip.episodeId === currentEpisodeId && onPlayClip) {
    onPlayClip(clip);
    return;
  }
  navigate(watchClipUrl(clip));
}

export function ReviewModal({ cards, onGrade, onClose, currentEpisodeId, onPlayClip }: Props) {
  const [queue] = useState(() => cards);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = queue[idx];
  const replayClip = card?.lastClip ?? card?.clip;
  const firstClip = card?.firstClip;

  if (!card) {
    return (
      <div className="ip-modal-backdrop" onClick={onClose}>
        <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ip-modal-done">Review complete 🎉</div>
          <button className="btn-primary" onClick={onClose}>Back to watching</button>
        </div>
      </div>
    );
  }

  const grade = (good: boolean) => {
    onGrade(card.dict, good);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  return (
    <div className="ip-modal-backdrop" onClick={onClose}>
      <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ip-modal-count">{idx + 1} / {queue.length}</div>
        <div className="ip-modal-context" lang="ja">{card.context.replaceAll(card.surface, "＿＿")}</div>
        <div className="ip-modal-word" lang="ja">{card.surface}</div>
        {replayClip && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => playClip(replayClip, currentEpisodeId, onPlayClip)}
          >
            Replay clip
          </button>
        )}
        {firstClip && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => playClip(firstClip, currentEpisodeId, onPlayClip)}
          >
            First encounter
          </button>
        )}
        {revealed ? (
          <>
            <div className="ip-modal-reading" lang="ja">{card.reading}</div>
            <div className="ip-modal-gloss">{card.gloss}</div>
            {card.contextEn && <div className="ip-modal-en">"{card.contextEn}"</div>}
            <div className="ip-modal-actions">
              <button className="btn-again" onClick={() => grade(false)}>Again</button>
              <button className="btn-primary" onClick={() => grade(true)}>Good</button>
            </div>
          </>
        ) : (
          <button className="btn-primary" onClick={() => setRevealed(true)}>Show answer</button>
        )}
      </div>
    </div>
  );
}
