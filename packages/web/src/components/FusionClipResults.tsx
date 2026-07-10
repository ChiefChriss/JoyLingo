/** Shared clip-match results UI (lesson pages + Home). */
import { useMemo, useState } from "react";
import type { ClipCandidate, CurriculumWord } from "@joylingo/shared";
import { candidateKey } from "../lib/fusion-deck";
import { navigate } from "../App";

interface Props {
  candidates: ClipCandidate[];
  words: Record<string, CurriculumWord>;
  emptyHint: string;
  onSave: (selected: ClipCandidate[], words: Record<string, CurriculumWord>) => Promise<void>;
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

export function FusionClipResults({ candidates, words, emptyHint, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const picked = candidates.filter((c) => selected.has(candidateKey(c)));
      await onSave(picked, words);
      setSavedMsg(`Saved ${picked.length} clip${picked.length === 1 ? "" : "s"} to your fusion deck.`);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (groups.length === 0) {
    return <p className="ip-paste-hint">{emptyHint}</p>;
  }

  return (
    <>
      {savedMsg && <div className="ip-modal-done">{savedMsg}</div>}
      {error && <div className="ip-error">{error}</div>}

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
                      <span className="chip">
                        {c.timingSource === "karaoke" ? "precise" : "estimated"}
                      </span>
                    </span>
                    <span className="ip-fusion-context" lang="ja">
                      {c.contextJa}
                    </span>
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
    </>
  );
}
