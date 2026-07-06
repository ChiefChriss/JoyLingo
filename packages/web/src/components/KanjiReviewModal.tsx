import { useEffect, useState } from "react";
import type { KanjiCardState, KanjiProgressMap } from "@joylingo/shared";
import { loadKanjiReference, lookupKanji } from "../lib/kanji";

interface Props {
  cards: KanjiCardState[];
  progress: KanjiProgressMap;
  onGrade: (char: string, good: boolean) => void;
  onClose: () => void;
}

export function KanjiReviewModal({ cards, progress, onGrade, onClose }: Props) {
  const [queue] = useState(() => cards);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ref, setRef] = useState<Record<string, import("@joylingo/shared").KanjiReference>>({});

  useEffect(() => {
    void loadKanjiReference().then(setRef);
  }, []);

  const card = queue[idx];

  if (!card) {
    return (
      <div className="ip-modal-backdrop" onClick={onClose}>
        <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ip-modal-done">Kanji review complete</div>
          <button className="btn-primary" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  const kanjiRef = lookupKanji(ref, card.char);
  const prog = progress[card.char];
  const meanings = kanjiRef?.meanings.join(", ") ?? "—";
  const readings = [
    ...(kanjiRef?.onReadings ?? []).map((r) => `on: ${r}`),
    ...(kanjiRef?.kunReadings ?? []).map((r) => `kun: ${r}`),
  ].join(" · ");

  const grade = (good: boolean) => {
    onGrade(card.char, good);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  return (
    <div className="ip-modal-backdrop" onClick={onClose}>
      <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ip-modal-count">Kanji · {idx + 1} / {queue.length}</div>
        {revealed ? (
          <>
            <div className="ip-kanji-big" lang="ja">{card.char}</div>
            <div className="ip-modal-reading" lang="ja">{readings || "—"}</div>
            <div className="ip-modal-gloss">{meanings}</div>
            {prog && (
              <div className="ip-modal-note">
                Seen in {prog.encounterCount} lookups · e.g. {prog.exampleDicts.join(", ")}
              </div>
            )}
            <div className="ip-modal-actions">
              <button className="btn-again" onClick={() => grade(false)}>Again</button>
              <button className="btn-primary" onClick={() => grade(true)}>Good</button>
            </div>
          </>
        ) : (
          <>
            <div className="ip-modal-gloss ip-kanji-prompt">What does this kanji mean?</div>
            <div className="ip-kanji-big" lang="ja">{card.char}</div>
            <button className="btn-primary" onClick={() => setRevealed(true)}>Show answer</button>
          </>
        )}
      </div>
    </div>
  );
}
