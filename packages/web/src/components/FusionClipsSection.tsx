/** Auto-suggest anime clips for curriculum vocabulary on lesson view. */
import { useEffect, useState } from "react";
import type { ClipCandidate, CurriculumWord, EduLessonId, FusionCardMap } from "@joylingo/shared";
import { matchCurriculumClips, saveFusionClips } from "../lib/api";
import { getDeviceId } from "../lib/vocabulary";
import { loadFusionDeck, mergeFusionCards, saveFusionDeck } from "../lib/fusion-deck";
import { ensureProfileSynced, loadProfile } from "../lib/profile";
import { FusionClipResults } from "./FusionClipResults";

interface Props {
  lessonId: EduLessonId;
  onDeckUpdate?: (deck: FusionCardMap) => void;
}

export function FusionClipsSection({ lessonId, onDeckUpdate }: Props) {
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [words, setWords] = useState<Record<string, CurriculumWord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profile = loadProfile();
  const hasFavorites = profile.favoriteAnime.length > 0;

  useEffect(() => {
    if (!hasFavorites) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureProfileSynced(profile);
        const data = await matchCurriculumClips(lessonId, getDeviceId());
        if (cancelled) return;
        setCandidates(data.candidates);
        setWords(data.words ?? {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, hasFavorites, profile]);

  if (!hasFavorites) {
    return (
      <section className="ip-fusion-section">
        <h2 className="ip-fusion-title">Hear it in your anime</h2>
        <p className="ip-paste-hint">
          Add favorite anime in onboarding to find real clips for lesson vocabulary.
        </p>
      </section>
    );
  }

  return (
    <section className="ip-fusion-section">
      <h2 className="ip-fusion-title">Hear it in your anime</h2>
      <p className="ip-paste-hint">
        Clips from your favorite shows that use words from this lesson. Select clips to save for
        review.
      </p>

      {loading && <div className="ip-loading">Finding clips…</div>}
      {error && <div className="ip-error">{error}</div>}

      {!loading && !error && (
        <FusionClipResults
          candidates={candidates}
          words={words}
          emptyHint="No clips found yet. Import episodes for your favorite anime from the home page."
          onSave={async (picked) => {
            const keys = picked.map((c) => `${c.curriculumWordId}:${c.episodeId}:${c.lineId}`);
            const cards = await saveFusionClips(lessonId, keys, getDeviceId());
            const merged = mergeFusionCards(loadFusionDeck(), cards);
            saveFusionDeck(merged);
            onDeckUpdate?.(merged);
          }}
        />
      )}
    </section>
  );
}
