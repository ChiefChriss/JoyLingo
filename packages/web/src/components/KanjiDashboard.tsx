import { useEffect, useMemo, useState } from "react";
import type { KanjiProgress, KanjiReference, VocabularyMap } from "@joylingo/shared";
import { deriveKanjiProgress, kanjiProgressList } from "@joylingo/player-core";
import { navigate } from "../App";
import { loadKanjiReference, lookupKanji } from "../lib/kanji";
import { loadVocabulary } from "../lib/vocabulary";

type Filter = "all" | "recent" | "unmined";

export function KanjiDashboard() {
  const [vocabulary, setVocabulary] = useState<VocabularyMap>(() => loadVocabulary());
  const [ref, setRef] = useState<Record<string, KanjiReference>>({});
  const [selected, setSelected] = useState<KanjiProgress | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void loadKanjiReference().then(setRef).catch((e: Error) => setLoadError(e.message));
  }, []);

  const progress = useMemo(() => deriveKanjiProgress(vocabulary), [vocabulary]);

  const list = useMemo(() => {
    let items = kanjiProgressList(progress);
    if (filter === "recent") {
      const weekAgo = Date.now() - 7 * 86_400_000;
      items = items.filter((p) => new Date(p.lastSeenAt).getTime() >= weekAgo);
    }
    if (filter === "unmined") {
      const minedDicts = new Set(
        Object.values(vocabulary).filter((v) => v.mined).map((v) => v.dict),
      );
      items = items.filter((p) => p.exampleDicts.some((d) => !minedDicts.has(d)));
    }
    return items;
  }, [progress, filter, vocabulary]);

  const detailRef = selected ? lookupKanji(ref, selected.char) : null;

  return (
    <div className="ip-root">
      <header className="ip-header">
        <div>
          <button className="ip-back" onClick={() => navigate("/")}>← Home</button>
          <h1 className="ip-title">Kanji <span className="ip-title-en">from your media</span></h1>
        </div>
        <span className="chip">{list.length} characters</span>
      </header>

      {loadError && <div className="ip-error">{loadError}</div>}

      <div className="ip-kanji-filters">
        {(["all", "recent", "unmined"] as const).map((f) => (
          <button
            key={f}
            className={"tool" + (filter === f ? " on" : "")}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "recent" ? "This week" : "Not mined"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="ip-deck-empty">
          Tap words while watching — kanji from those lookups appear here.
        </div>
      ) : (
        <div className="ip-kanji-grid">
          {list.map((p) => (
            <button
              key={p.char}
              className={"ip-kanji-cell" + (selected?.char === p.char ? " sel" : "")}
              onClick={() => setSelected(p)}
              lang="ja"
            >
              <span className="ip-kanji-char">{p.char}</span>
              <span className="ip-kanji-count">{p.encounterCount}×</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <aside className="ip-kanji-detail">
          <div className="ip-kanji-detail-head">
            <span className="ip-kanji-big" lang="ja">{selected.char}</span>
            <button className="ip-dict-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
          </div>
          {detailRef ? (
            <>
              <div className="ip-kanji-meanings">{detailRef.meanings.join(", ")}</div>
              <div className="ip-kanji-readings" lang="ja">
                {detailRef.onReadings.length > 0 && (
                  <span>On: {detailRef.onReadings.join("、")}</span>
                )}
                {detailRef.kunReadings.length > 0 && (
                  <span>Kun: {detailRef.kunReadings.join("、")}</span>
                )}
              </div>
              {(detailRef.jlpt || detailRef.grade) && (
                <div className="ip-kanji-meta">
                  {detailRef.jlpt && <span className="chip">JLPT N{detailRef.jlpt}</span>}
                  {detailRef.grade && <span className="chip">Grade {detailRef.grade}</span>}
                </div>
              )}
            </>
          ) : (
            <div className="ip-kanji-meanings">No reference entry (run build-kanjidic)</div>
          )}
          <div className="ip-section-label">Example words you looked up</div>
          <ul className="ip-kanji-examples">
            {selected.exampleDicts.map((dict) => {
              const entry = vocabulary[dict];
              return (
                <li key={dict}>
                  <span lang="ja">{dict}</span>
                  {entry && (
                    <button
                      className="ip-link"
                      onClick={() =>
                        navigate(`/watch/${encodeURIComponent(entry.lastClip.episodeId)}`)
                      }
                    >
                      watch clip
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="ip-kanji-meta">
            {selected.encounterCount} lookups · status: {selected.status}
          </div>
        </aside>
      )}
    </div>
  );
}
