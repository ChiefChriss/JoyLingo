/** Home: find anime clips for words in the mined deck. */
import { useEffect, useMemo, useState } from "react";
import type { ClipCandidate, CurriculumWord, UserProfile } from "@joylingo/shared";
import { matchWordClips, saveFusionClipsDirect, type MatchWordInput } from "../lib/api";
import { loadDeck } from "../lib/deck";
import { mergeFusionCards, saveFusionDeck, loadFusionDeck } from "../lib/fusion-deck";
import { ensureProfileSynced } from "../lib/profile";
import { getDeviceId } from "../lib/vocabulary";
import { FusionClipResults } from "./FusionClipResults";

const MAX_WORDS = 25;

interface Props {
  profile: UserProfile;
}

function deckWordsForMatch(): MatchWordInput[] {
  const deck = loadDeck();
  return Object.entries(deck)
    .filter(([, e]) => e.status === "learning")
    .slice(0, MAX_WORDS)
    .map(([dict, e]) => ({
      id: `mined:${dict}`,
      dict,
      surface: e.surface,
      reading: e.reading,
      gloss: e.gloss ?? "",
    }));
}

export function HomeClipsSection({ profile }: Props) {
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [words, setWords] = useState<Record<string, CurriculumWord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const matchWords = useMemo(() => deckWordsForMatch(), []);
  const hasFavorites = profile.favoriteAnime.length > 0;
  const hasDeck = matchWords.length > 0;

  useEffect(() => {
    if (!hasFavorites || !hasDeck) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureProfileSynced(profile);
        const data = await matchWordClips(matchWords, getDeviceId());
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
  }, [profile, matchWords, hasFavorites, hasDeck]);

  if (!hasFavorites) return null;

  return (
    <section className="ip-home-section ip-fusion-section">
      <div className="ip-section-head">
        <div className="ip-section-label">Clips for your words</div>
        {hasDeck && <span className="chip">{matchWords.length} learning</span>}
      </div>
      <p className="ip-paste-hint">
        Short scenes from your favorite anime that use words you&apos;ve mined while watching.
      </p>

      {!hasDeck && (
        <p className="ip-paste-hint">
          Mine words during immersion (tap a subtitle word → Add to deck), then come back here for
          clip suggestions.
        </p>
      )}

      {loading && hasDeck && <div className="ip-loading">Searching your anime…</div>}
      {error && <div className="ip-error">{error}</div>}

      {!loading && !error && hasDeck && (
        <FusionClipResults
          candidates={candidates}
          words={words}
          emptyHint="No clips found yet. Import episodes for your favorite anime, then mine some vocabulary."
          onSave={async (picked, wordMap) => {
            const clips = picked.map((c) => {
              const w = wordMap[c.curriculumWordId];
              return {
                curriculumWordId: c.curriculumWordId,
                dict: c.dict,
                reading: w?.reading ?? c.surface,
                glossExpected: w?.gloss ?? c.gloss ?? "",
                surface: c.surface,
                contextJa: c.contextJa,
                contextEn: c.contextEn,
                episodeId: c.episodeId,
                lineId: c.lineId,
                clipStart: c.clipStart,
                clipEnd: c.clipEnd,
                timingSource: c.timingSource,
              };
            });
            const cards = await saveFusionClipsDirect(clips, getDeviceId());
            saveFusionDeck(mergeFusionCards(loadFusionDeck(), cards));
          }}
        />
      )}
    </section>
  );
}
