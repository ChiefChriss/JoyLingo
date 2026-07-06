import { useMemo, useState } from "react";
import type { FusionCard } from "@joylingo/shared";
import {
  fusionDistractors,
  gradeFusionCard,
  shuffleChoices,
} from "@joylingo/player-core";
import { navigate } from "../App";

interface Props {
  cards: FusionCard[];
  lessonGlosses: string[];
  onGrade: (card: FusionCard, good: boolean) => void;
  onClose: () => void;
}

export function FusionReviewModal({ cards, lessonGlosses, onGrade, onClose }: Props) {
  const [queue] = useState(() => cards);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const card = queue[idx];

  const choices = useMemo(() => {
    if (!card) return [];
    const distractors = fusionDistractors(card.glossExpected, lessonGlosses, 3);
    return shuffleChoices([card.glossExpected, ...distractors]);
  }, [card, lessonGlosses]);

  if (!card) {
    return (
      <div className="ip-modal-backdrop" onClick={onClose}>
        <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ip-modal-done">Fusion review complete</div>
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  const contextCloze = card.contextJa.replaceAll(card.surface, "＿＿");
  const correct = picked === card.glossExpected;

  const answer = (good: boolean) => {
    const graded = gradeFusionCard(card, good);
    onGrade(graded, good);
    setPicked(null);
    setIdx((i) => i + 1);
  };

  const pick = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    setTimeout(() => answer(choice === card.glossExpected), 1200);
  };

  const watchUrl = `/watch/${encodeURIComponent(card.episodeId)}?${new URLSearchParams({
    line: card.lineId,
    clipStart: String(card.clipStart),
    clipEnd: String(card.clipEnd),
    autoplay: "1",
  }).toString()}`;

  return (
    <div className="ip-modal-backdrop" onClick={onClose}>
      <div className="ip-modal ip-fusion-review" onClick={(e) => e.stopPropagation()}>
        <div className="ip-modal-count">{idx + 1} / {queue.length}</div>
        <p className="ip-paste-hint">What does the missing word mean in this clip?</p>
        <div className="ip-modal-context" lang="ja">{contextCloze}</div>
        <div className="ip-modal-word" lang="ja">{card.surface}</div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate(watchUrl)}
        >
          Play clip
        </button>
        <div className="ip-fusion-mc">
          {choices.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`ip-fusion-choice${
                picked
                  ? ch === card.glossExpected
                    ? " ip-fusion-choice-correct"
                    : ch === picked
                      ? " ip-fusion-choice-wrong"
                      : ""
                  : ""
              }`}
              disabled={Boolean(picked)}
              onClick={() => pick(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
        {picked && (
          <div className="ip-modal-actions">
            <button type="button" className="btn-again" onClick={() => answer(false)}>
              Again
            </button>
            <button type="button" className="btn-primary" onClick={() => answer(correct)}>
              {correct ? "Good" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
