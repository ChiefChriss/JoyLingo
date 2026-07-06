/** Auto-suggest anime clips for curriculum vocabulary on lesson view. */
import { useEffect, useMemo, useState } from "react";
import type { ClipCandidate, CurriculumWord, EduLessonId } from "@joylingo/shared";
import { matchCurriculumClips, saveFusionClips } from "../lib/api";
import { getDeviceId } from "../lib/vocabulary";
import {
  candidateKey,
  loadFusionDeck,
  mergeFusionCards,
  saveFusionDeck,
} from "../lib/fusion-deck";
import { navigate } from "../App";
import { loadProfile } from "../lib/profile";

interface Props {
  lessonId: EduLessonId;
}

function groupByWord(
  candidates: ClipCandidate[],
  words: Record<string, CurriculumWord>,
): { word: CurriculumWord; clips: ClipCandidate[] }[] {
  const map = new Map<string, ClipCandidate[]>();
  for (const c of candidates) {
    const list = map.get(c.curriculumWordId) ?? [];
    list.push(c);
    map.set(c.curriculumWordId, list);
  }
  return [...map.entries()]
    .map(([id, clips]) => {
      const word = words[id];
      if (!word) return null;
      return { word, clips };
    })
    .filter((g): g is { word: CurriculumWord; clips: ClipCandidate[] } => g != null);
}

export function FusionClipsSection({ lessonId }: Props) {
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [words, setWords] = useState<Record<string, CurriculumWord>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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
  }, [lessonId, hasFavorites]);

  const groups = useMemo(() => groupByWord(candidates, words), [candidates, words]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const cards = await saveFusionClips(lessonId, [...selected], getDeviceId());
      const deck = mergeFusionCards(loadFusionDeck(), cards);
      saveFusionDeck(deck);
      setSavedMsg(`Saved ${cards.length} clip${cards.length === 1 ? "" : "s"} to your fusion deck.`);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

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
        Clips from your favorite shows that use words from this lesson. Select clips to save for review.
      </p>

      {loading && <div className="ip-loading">Finding clips…</div>}
      {error && <div className="ip-error">{error}</div>}
      {savedMsg && <div className="ip-modal-done">{savedMsg}</div>}

      {!loading && !error && groups.length === 0 && (
        <p className="ip-paste-hint">
          No clips found yet. Import episodes for your favorite anime from the home page.
        </p>
      )}

      {groups.map(({ word, clips }) => (
        <div key={word.id} className="ip-fusion-word-group">
          <h3 className="ip-fusion-word" lang="ja">
            {word.surface}
            <span className="ip-fusion-reading"> ({word.reading})</span>
            <span className="ip-fusion-gloss"> — {word.gloss}</span>
          </h3>
          <ul className="ip-fusion-clip-list">
            {clips.map((c) => {
              const key = candidateKey(c);
              return (
                <li key={key} className="ip-fusion-clip-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                    />
                    <span className="ip-fusion-clip-meta">
                      <strong>{c.episodeTitle}</strong>
                      <span className="chip">{c.timingSource === "karaoke" ? "precise" : "estimated"}</span>
                    </span>
                    <span className="ip-fusion-context" lang="ja">{c.contextJa}</span>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary ip-fusion-preview"
                    onClick={() => {
                      const params = new URLSearchParams({
                        line: c.lineId,
                        clipStart: String(c.clipStart),
                        clipEnd: String(c.clipEnd),
                        autoplay: "1",
                      });
                      navigate(`/watch/${encodeURIComponent(c.episodeId)}?${params.toString()}`);
                    }}
                  >
                    Preview
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {groups.length > 0 && (
        <div className="ip-fusion-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={selected.size === 0 || saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : `Save ${selected.size} selected clip${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </section>
  );
}
