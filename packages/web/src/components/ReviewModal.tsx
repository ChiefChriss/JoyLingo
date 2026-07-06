import { useState } from "react";
import type { DeckCard } from "@joylingo/player-core";

interface Props {
  cards: DeckCard[];
  onGrade: (dict: string, good: boolean) => void;
  onClose: () => void;
}

export function ReviewModal({ cards, onGrade, onClose }: Props) {
  // Snapshot the queue on open: the parent's due list shrinks as cards are
  // graded "known", which would shift indices and skip cards mid-session.
  const [queue] = useState(() => cards);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = queue[idx];

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
        <div className="ip-modal-note">
          In production, "Again/Good" feeds FSRS scheduling and the card replays the clip audio.
        </div>
      </div>
    </div>
  );
}
