import { memo, useMemo, useState } from "react";
import type { VocabularyEntry, VocabularyMap } from "@joylingo/shared";
import type { DeckCard } from "@joylingo/player-core";
import { vocabularyList } from "@joylingo/player-core";

interface Props {
  deck: DeckCard[];
  vocabulary: VocabularyMap;
  dueCount: number;
  kanjiDueCount?: number;
  onReview: () => void;
  onReviewKanji?: () => void;
}

type Tab = "learning" | "encountered";

const EncounteredCard = memo(function EncounteredCard({ entry }: { entry: VocabularyEntry }) {
  return (
    <div className={"ip-card" + (entry.mined ? " mined" : "")}>
      <div className="ip-card-word" lang="ja">{entry.dict}</div>
      <div className="ip-card-reading" lang="ja">{entry.reading}</div>
      <div className="ip-card-gloss">{entry.gloss ?? "—"}</div>
      <div className="ip-card-meta">
        {entry.tapCount}× · {entry.mined ? "in deck" : "looked up"}
      </div>
    </div>
  );
});

export const DeckPanel = memo(function DeckPanel({
  deck,
  vocabulary,
  dueCount,
  kanjiDueCount = 0,
  onReview,
  onReviewKanji,
}: Props) {
  const [tab, setTab] = useState<Tab>("learning");
  const encountered = useMemo(
    () => vocabularyList(vocabulary, { sort: "recent" }),
    [vocabulary],
  );

  return (
    <section className="ip-deck">
      <div className="ip-deck-head">
        <div className="ip-deck-tabs">
          <button
            className={"ip-deck-tab" + (tab === "learning" ? " on" : "")}
            onClick={() => setTab("learning")}
          >
            Learning ({deck.length})
          </button>
          <button
            className={"ip-deck-tab" + (tab === "encountered" ? " on" : "")}
            onClick={() => setTab("encountered")}
          >
            Encountered ({encountered.length})
          </button>
        </div>
        <div className="ip-deck-actions">
          {tab === "learning" && dueCount > 0 && (
            <button className="btn-primary" onClick={onReview}>Review {dueCount}</button>
          )}
          {kanjiDueCount > 0 && onReviewKanji && (
            <button className="btn-secondary" onClick={onReviewKanji}>
              Kanji {kanjiDueCount}
            </button>
          )}
        </div>
      </div>

      {tab === "learning" ? (
        deck.length === 0 ? (
          <div className="ip-deck-empty">
            Tap any word in a subtitle, then "Add to deck". Mined words feed spaced repetition
            and each card keeps a link back to its clip.
          </div>
        ) : (
          <div className="ip-deck-grid">
            {deck.map((c) => (
              <div key={c.dict} className={"ip-card" + (c.status === "known" ? " known" : "")}>
                <div className="ip-card-word" lang="ja">{c.dict}</div>
                <div className="ip-card-reading" lang="ja">{c.reading}</div>
                <div className="ip-card-gloss">{c.gloss}</div>
                <div className={"ip-card-status " + c.status}>{c.status}</div>
              </div>
            ))}
          </div>
        )
      ) : encountered.length === 0 ? (
        <div className="ip-deck-empty">
          Words you tap in subtitles are logged here — even before you add them to your deck.
        </div>
      ) : (
        <div className="ip-deck-grid">
          {encountered.map((e) => (
            <EncounteredCard key={e.dict} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
});
