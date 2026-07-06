/** Shared anime search + selection UI (extracted from AnimeLearnModal). */
import { useEffect, useState } from "react";
import { searchAnime, type AnimeSummary } from "../lib/api";

interface Props {
  /** Selected MAL ids. */
  selected: Set<number>;
  /** Toggle membership for a MAL id; render state stays local to the picker. */
  onToggle: (anime: AnimeSummary) => void;
  /** Lower bound enforced when truthy (used by onboarding's 3–5 prompt). */
  max?: number;
  /** Disable interaction while the parent is performing I/O. */
  busy?: boolean;
  /** Prefill the search box without firing a search (avoids Jikan spam). */
  initialQuery?: string;
  /** When false, user must click Search (default in modals). */
  searchOnMount?: boolean;
}

function toSummary(a: AnimeSummary) {
  return {
    malId: a.malId,
    title: a.english ?? a.romaji,
    coverImageURL: a.coverImageURL,
  };
}

export function AnimeSearchPicker({
  selected,
  onToggle,
  max,
  busy,
  initialQuery = "",
  searchOnMount = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AnimeSummary[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = async (q = query.trim()) => {
    if (!q) return;
    setPending(true);
    setError(null);
    try {
      setResults(await searchAnime(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (searchOnMount && initialQuery.trim()) {
      void doSearch(initialQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ip-anime-picker">
      <div className="ip-attach-search">
        <input
          value={query}
          placeholder="Search anime by title…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query.trim() && doSearch()}
        />
        <button className="btn-primary" disabled={pending || busy || !query.trim()} onClick={() => doSearch()}>
          {pending ? "Searching…" : "Search"}
        </button>
      </div>

      {!results && !pending && !error && (
        <div className="ip-attach-empty">Search by anime title to get started.</div>
      )}

      {error && <div className="ip-attach-error">{error}</div>}

      {results && (
        <div className="ip-attach-list">
          {results.length === 0 && !pending && (
            <div className="ip-attach-empty">No anime found.</div>
          )}
          {results.map((a) => {
            const isSel = selected.has(a.malId);
            const disabled = !isSel && max != null && selected.size >= max;
            return (
              <button
                key={a.malId}
                className={"ip-attach-item" + (isSel ? " sel" : "")}
                disabled={disabled || busy}
                onClick={() => onToggle(a)}
              >
                {a.coverImageURL && <img className="ip-anime-cover" src={a.coverImageURL} alt="" />}
                <span>
                  <span lang="ja">{a.native ?? a.romaji}</span>
                  {a.english && a.english !== a.romaji && (
                    <span className="ip-attach-sub">{a.english}</span>
                  )}
                  {a.episodes != null && (
                    <span className="ip-attach-sub">{a.episodes} episodes</span>
                  )}
                </span>
                <span className={"chip" + (isSel ? " chip-amber" : "")}>
                  {isSel ? "✓ Pick" : "Pick"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {max != null && (
        <div className="ip-paste-hint">
          {selected.size}/{max} selected{selected.size < 3 ? " · pick at least 3" : ""}.
        </div>
      )}

      {/* Expose selected as catalog rows for parents that track favorites. */}
      <SelectedChips selected={selected} results={results} onToggle={onToggle} />
    </div>
  );
}

function SelectedChips({
  selected,
  results,
  onToggle,
}: {
  selected: Set<number>;
  results: AnimeSummary[] | null;
  onToggle: (a: AnimeSummary) => void;
}) {
  if (selected.size === 0 || !results) return null;
  const picks = results.filter((a) => selected.has(a.malId));
  return (
    <div className="ip-anime-chips">
      {picks.map((a) => (
        <button
          key={a.malId}
          className="ip-anime-chip"
          onClick={() => onToggle(a)}
          title="Remove"
        >
          {toSummary(a).title} ✕
        </button>
      ))}
    </div>
  );
}