/** Home entry point for fusion clip review (due cards). */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FusionCard } from "@joylingo/shared";
import { dueFusionCards } from "@joylingo/player-core";
import { fetchDueFusionCards, postFusionReview } from "../lib/api";
import { loadFusionDeck, mergeFusionCards, saveFusionDeck } from "../lib/fusion-deck";
import { getDeviceId } from "../lib/vocabulary";
import { FusionReviewModal } from "./FusionReviewModal";
import { ModalPortal } from "./ModalPortal";

export function HomeFusionReview() {
  const [fusionDeck, setFusionDeck] = useState(() => loadFusionDeck());
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    void fetchDueFusionCards(getDeviceId()).then((remote) => {
      if (remote.length > 0) {
        setFusionDeck((prev) => mergeFusionCards(prev, remote));
      }
    });
  }, []);

  const dueCards = useMemo(
    () => dueFusionCards(Object.values(fusionDeck)),
    [fusionDeck],
  );

  const glossPool = useMemo(
    () => Object.values(fusionDeck).map((c) => c.glossExpected),
    [fusionDeck],
  );

  const handleGrade = useCallback((card: FusionCard, good: boolean) => {
    setFusionDeck((prev) => {
      const next = { ...prev, [card.id]: card };
      saveFusionDeck(next);
      return next;
    });
    void postFusionReview(card.id, good, getDeviceId());
  }, []);

  if (dueCards.length === 0) return null;

  return (
    <>
      <section className="ip-cta-card ip-fusion-due-banner">
        <div className="ip-section-label">Clip review</div>
        <p className="ip-paste-hint">
          {dueCards.length} anime clip{dueCards.length === 1 ? "" : "s"} ready — hear the word in
          context and test your recall.
        </p>
        <button type="button" className="btn-primary" onClick={() => setReviewing(true)}>
          Review {dueCards.length} clip{dueCards.length === 1 ? "" : "s"}
        </button>
      </section>

      {reviewing && (
        <ModalPortal>
          <FusionReviewModal
            cards={dueCards}
            lessonGlosses={glossPool}
            onGrade={handleGrade}
            onClose={() => setReviewing(false)}
          />
        </ModalPortal>
      )}
    </>
  );
}
