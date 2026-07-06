import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Episode, Line, WordToken } from "@joylingo/shared";
import {
  HtmlVideoPlayerAdapter,
  MockPlayerAdapter,
  YouTubePlayerAdapter,
  usePlaybackClock,
  findActiveLine,
  mineEntry,
  toDeck,
  recordEncounter,
  markMined,
  dueKanjiCards,
  gradeKanjiCard,
  type EpisodeSource,
  type KnowledgeMap,
  type KnowledgeStatus,
  type PlayerAdapter,
} from "@joylingo/player-core";
import type { KanjiCardMap, VocabularyMap } from "@joylingo/shared";
import { fetchEpisode, formatTime } from "../lib/episodes";
import {
  buildProxyUrl,
  fetchStreamSources,
  patchSubtitleOffset,
  postKanjiReview,
  postVocabularyEncounter,
  postVocabularyMine,
} from "../lib/api";
import {
  loadVocabulary,
  saveVocabulary,
  loadKanjiCards,
  saveKanjiCards,
  syncKanjiFromVocabulary,
  getDeviceId,
} from "../lib/vocabulary";
import { loadDeck, saveDeck } from "../lib/deck";
import { markStepComplete } from "../lib/curriculum";
import { navigate } from "../App";
import { SubtitleLine } from "./SubtitleLine";
import { DictionaryCard } from "./DictionaryCard";
import { Transcript } from "./Transcript";
import { DeckPanel } from "./DeckPanel";
import { ReviewModal } from "./ReviewModal";
import { KanjiReviewModal } from "./KanjiReviewModal";

export interface Selection {
  tok: WordToken;
  line: Line;
}

const YT_MOUNT_ID = "yt-mount";

const offsetStorageKey = (episodeId: string) => `joylingo:offset:${episodeId}`;

function loadStoredOffset(episodeId: string): number | null {
  const raw = localStorage.getItem(offsetStorageKey(episodeId));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type TokenStatus = KnowledgeStatus | "encountered" | null;

export interface ClipSegmentOptions {
  lineId: string;
  clipStart: number;
  clipEnd: number;
  autoplay?: boolean;
}

/** Player + subtitle zone — isolated so clock ticks don't re-render the transcript/deck. */
const PlaybackSection = memo(function PlaybackSection({
  episode,
  source,
  offset,
  defaultOffset,
  furigana,
  showEn,
  showSync,
  selected,
  statusOf,
  onWordTap,
  onOffsetChange,
  onToggleFurigana,
  onToggleEn,
  onToggleSync,
  seekRef,
  onActiveLineChange,
  clipSegment,
}: {
  episode: Episode;
  source: EpisodeSource;
  offset: number;
  defaultOffset: number;
  furigana: boolean;
  showEn: boolean;
  showSync: boolean;
  selected: Selection | null;
  statusOf: (tok: WordToken) => TokenStatus;
  onWordTap: (tok: WordToken, line: Line) => void;
  onOffsetChange: (next: number) => void;
  onToggleFurigana: () => void;
  onToggleEn: () => void;
  onToggleSync: () => void;
  seekRef: React.MutableRefObject<(seconds: number) => void>;
  onActiveLineChange: (lineId: string | null) => void;
  clipSegment?: ClipSegmentOptions | null;
}) {
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<PlayerAdapter | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const { youtubeVideoId, animeStream } = source;
  const isAnime = Boolean(animeStream);
  const syncMin = isAnime ? -300 : -10;
  const syncMax = isAnime ? 300 : 10;

  // Bind stream once both the <video> node and source URL are ready.
  useEffect(() => {
    setPlayerError(null);

    if (youtubeVideoId) {
      const a = new YouTubePlayerAdapter(YT_MOUNT_ID, youtubeVideoId, (err) =>
        setPlayerError(err.message),
      );
      setAdapter(a);
      return () => {
        a.destroy();
        setAdapter(null);
      };
    }

    if (!animeStream || !videoEl) {
      if (!animeStream) {
        const a = new MockPlayerAdapter(episode.duration);
        setAdapter(a);
        return () => {
          a.destroy();
          setAdapter(null);
        };
      }
      return;
    }

    let cancelled = false;
    setStreamLoading(true);
    setAdapter(null);

    void (async () => {
      try {
        const sources = await fetchStreamSources(
          animeStream.showId,
          animeStream.episode,
          animeStream.mode,
        );
        if (cancelled) return;
        const best = sources[0];
        if (!best) throw new Error("No playable stream sources found");

        videoEl.src = buildProxyUrl(best.url, best.referer);
        videoEl.load();

        const a = new HtmlVideoPlayerAdapter(videoEl, (err) => setPlayerError(err.message));
        if (cancelled) {
          a.destroy();
          return;
        }
        setAdapter(a);
      } catch (err) {
        if (!cancelled) {
          setPlayerError(err instanceof Error ? err.message : "Stream load failed");
        }
      } finally {
        if (!cancelled) setStreamLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setAdapter((prev) => {
        prev?.destroy();
        return null;
      });
    };
  }, [
    episode.duration,
    youtubeVideoId,
    animeStream?.showId,
    animeStream?.episode,
    animeStream?.mode,
    videoEl,
  ]);

  const hasVideo = Boolean(youtubeVideoId || animeStream);

  useEffect(() => {
    if (!hasVideo || !adapter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable]")) return;
      e.preventDefault();
      if (adapter.isPlaying()) adapter.pause();
      else adapter.play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasVideo, adapter]);

  const clock = usePlaybackClock(adapter);
  const duration = clock.duration || episode.duration;

  useEffect(() => {
    seekRef.current = (seconds) => clock.seek(seconds);
  }, [clock, seekRef]);

  const subTime = clock.currentTime - offset;
  const activeLine = useMemo(
    () => findActiveLine(episode.lines, subTime),
    [episode.lines, subTime],
  );

  useEffect(() => {
    onActiveLineChange(activeLine?.id ?? null);
  }, [activeLine?.id, onActiveLineChange]);

  const clipStartedRef = useRef(false);
  useEffect(() => {
    if (!clipSegment || !adapter || clipStartedRef.current) return;
    clipStartedRef.current = true;
    const seekTo = clipSegment.clipStart + offset;
    clock.seek(seekTo);
    onActiveLineChange(clipSegment.lineId);
    if (clipSegment.autoplay) adapter.play();
  }, [clipSegment, adapter, offset, clock, onActiveLineChange]);

  useEffect(() => {
    if (!clipSegment || !adapter) return;
    const end = clipSegment.clipEnd + offset;
    if (clock.currentTime >= end && adapter.isPlaying()) {
      adapter.pause();
    }
  }, [clock.currentTime, clipSegment, offset, adapter]);

  const seekFraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    clock.seek(frac * duration);
  };

  return (
    <>
      <div className="ip-player">
        {youtubeVideoId ? (
          <div className="ip-yt-frame">
            <div id={YT_MOUNT_ID} />
            {playerError && <div className="ip-player-error">{playerError}</div>}
          </div>
        ) : animeStream ? (
          <div className="ip-yt-frame ip-anime-frame">
            <video
              ref={(el) => {
                videoRef.current = el;
                setVideoEl(el);
              }}
              className="ip-anime-video"
              controls
              playsInline
              preload="metadata"
            />
            {streamLoading && <div className="ip-player-loading">Loading stream…</div>}
            {playerError && <div className="ip-player-error">{playerError}</div>}
          </div>
        ) : (
          <div className="ip-scene" onClick={clock.toggle}>
            <div className={"ip-scene-glow" + (clock.playing ? " on" : "")} />
            <div className="ip-scene-label">
              EP 01 · {formatTime(clock.currentTime)} / {formatTime(duration)}
            </div>
            <div className="ip-scene-center">
              <button
                className="ip-playbtn"
                onClick={(e) => { e.stopPropagation(); clock.toggle(); }}
                aria-label={clock.playing ? "Pause" : "Play"}
              >
                {clock.playing ? "❚❚" : "▶"}
              </button>
              <div className="ip-scene-hint">
                {clock.playing ? "" : "mock player — bind a youtubeVideoId in episodes/index.json"}
              </div>
            </div>
          </div>
        )}
        <div className="ip-progress" onClick={seekFraction}>
          <div
            className="ip-progress-fill"
            style={{ width: duration ? `${(clock.currentTime / duration) * 100}%` : "0%" }}
          />
          {duration > 0 && episode.lines.map((l) => (
            <div
              key={l.id}
              className="ip-progress-tick"
              style={{ left: `${((l.start + offset) / duration) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <section className="ip-subtitle-zone">
        {activeLine ? (
          <SubtitleLine
            line={activeLine}
            furigana={furigana}
            selected={selected}
            statusOf={statusOf}
            onTap={(tok) => onWordTap(tok, activeLine)}
          />
        ) : (
          <div className="ip-sub-empty">
            {clock.playing
              ? isAnime
                ? "No line at this timestamp — slide sync below, or tap a line in the transcript"
                : "…"
              : "Press play — subtitles sync to the video clock"}
          </div>
        )}
        <div className="ip-sub-tools">
          <button className={"tool" + (furigana ? " on" : "")} onClick={onToggleFurigana}>
            ふりがな
          </button>
          <button className={"tool" + (showEn ? " on" : "")} onClick={onToggleEn}>
            EN
          </button>
          <button className={"tool" + (showSync ? " on" : "")} onClick={onToggleSync}>
            sync
          </button>
        </div>
        {showEn && activeLine && <div className="ip-sub-en">{activeLine.en}</div>}
        {showSync && (
          <div className="ip-sync">
            <label>
              Subtitle offset: {offset.toFixed(2)}s
              {isAnime && (
                <span className="ip-sync-hint">
                  {" "}
                  — anime subs often need ±60–120s
                </span>
              )}
              <input
                type="range"
                min={syncMin}
                max={syncMax}
                step={0.5}
                value={offset}
                onChange={(e) => onOffsetChange(Number(e.target.value))}
              />
            </label>
            <button className="tool" onClick={() => onOffsetChange(defaultOffset)}>reset</button>
          </div>
        )}
      </section>
    </>
  );
});

export function ImmersionPlayer({
  source,
  clipSegment = null,
}: {
  source: EpisodeSource;
  clipSegment?: ClipSegmentOptions | null;
}) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [furigana, setFurigana] = useState(true);
  const [showEn, setShowEn] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgeMap>(() => loadDeck());
  const [vocabulary, setVocabulary] = useState<VocabularyMap>(() => loadVocabulary());
  const [kanjiCards, setKanjiCards] = useState<KanjiCardMap>(() => loadKanjiCards());
  const [reviewing, setReviewing] = useState(false);
  const [reviewingKanji, setReviewingKanji] = useState(false);
  const defaultOffset = source.subtitleOffset ?? 0;
  const [offset, setOffset] = useState(
    () => loadStoredOffset(source.episodeId) ?? defaultOffset,
  );
  const [showSync, setShowSync] = useState(() => Boolean(source.animeStream));
  const seekRef = useRef<(seconds: number) => void>(() => {});

  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [watchedOnce, setWatchedOnce] = useState(false);
  const [reviewedOnce, setReviewedOnce] = useState(false);

  useEffect(() => {
    const key = offsetStorageKey(source.episodeId);
    if (offset === defaultOffset) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(offset));
    const t = setTimeout(() => void patchSubtitleOffset(source.episodeId, offset), 800);
    return () => clearTimeout(t);
  }, [offset, defaultOffset, source.episodeId]);

  useEffect(() => {
    saveVocabulary(vocabulary);
    setKanjiCards((prev) => {
      const { cards: next } = syncKanjiFromVocabulary(vocabulary, prev);
      if (Object.keys(prev).length === Object.keys(next).length) return prev;
      saveKanjiCards(next);
      return next;
    });
    // Persist the mined word deck so onboarding progress survives refresh.
    saveDeck(knowledge);
  }, [vocabulary, knowledge]);

  const kanjiProgress = useMemo(
    () => syncKanjiFromVocabulary(vocabulary, kanjiCards).progress,
    [vocabulary, kanjiCards],
  );

  const deck = useMemo(() => toDeck(knowledge), [knowledge]);
  const dueCards = useMemo(() => deck.filter((c) => c.status === "learning"), [deck]);
  const dueKanji = useMemo(() => dueKanjiCards(kanjiCards), [kanjiCards]);
  const knownCount = useMemo(() => deck.filter((c) => c.status === "known").length, [deck]);
  const minedCount = useMemo(
    () => deck.filter((c) => c.status === "learning" || c.status === "known").length,
    [deck],
  );

  // First-watch curriculum hook: once subtitles roll past 1 second, count it.
  useEffect(() => {
    if (!watchedOnce && activeLineId) {
      setWatchedOnce(true);
      markStepComplete("immersion", source.episodeId);
    }
  }, [activeLineId, watchedOnce, source.episodeId]);

  // Mine-step curriculum hook: ≥10 mined words completes the mine step.
  useEffect(() => {
    if (minedCount >= 10) markStepComplete("mine", source.episodeId);
  }, [minedCount, source.episodeId]);

  useEffect(() => {
    fetchEpisode(source).then(setEpisode, (e: Error) => setLoadError(e.message));
  }, [source]);

  const statusOf = useCallback((tok: WordToken): TokenStatus => {
    if (knowledge[tok.dict]?.status) return knowledge[tok.dict]!.status;
    if (vocabulary[tok.dict]) return "encountered";
    return null;
  }, [knowledge, vocabulary]);

  const handleWordTap = useCallback((tok: WordToken, line: Line) => {
    setSelected({ tok, line });
    const mined = Boolean(knowledge[tok.dict]);
    setVocabulary((v) =>
      recordEncounter(
        { tok, line, episodeId: source.episodeId, mined },
        v,
      ),
    );
    void postVocabularyEncounter(
      {
        dict: tok.dict,
        reading: tok.r ?? tok.s,
        gloss: tok.gloss,
        surface: tok.s,
        episodeId: source.episodeId,
        lineId: line.id,
        mined,
      },
      getDeviceId(),
    );
  }, [knowledge, source.episodeId]);

  const jumpToLine = useCallback((line: Line) => {
    seekRef.current(line.start + offset + 0.01);
    setSelected(null);
    setActiveLineId(line.id);
  }, [offset]);

  const addToDeck = useCallback((tok: WordToken, line: Line) => {
    setKnowledge((k) => ({ ...k, [tok.dict]: mineEntry(tok, line) }));
    setVocabulary((v) => markMined(tok.dict, v));
    void postVocabularyMine(tok.dict, getDeviceId());
  }, []);

  const onActiveLineChange = useCallback((lineId: string | null) => {
    setActiveLineId(lineId);
  }, []);

  if (loadError) return <div className="ip-root"><div className="ip-error">{loadError}</div></div>;
  if (!episode) return <div className="ip-root"><div className="ip-loading">Loading episode…</div></div>;

  const noLines = episode.lines.length === 0;

  return (
    <div className="ip-root">
      <header className="ip-header">
        <div>
          <button className="ip-back" onClick={() => navigate("/")}>← Episodes</button>
          <h1 className="ip-title">
            {episode.title} <span className="ip-title-en">{episode.titleEn}</span>
          </h1>
        </div>
        <div className="ip-header-stats">
          <button className="chip chip-link" onClick={() => navigate("/kanji")}>Kanji</button>
          <span className="chip chip-amber">{dueCards.length} to review</span>
          <span className="chip">{knownCount} known</span>
        </div>
      </header>

      {noLines && (
        <div className="ip-attach-error">
          No subtitle lines were parsed from this file — try re-importing with a different Jimaku track.
        </div>
      )}

      <PlaybackSection
        episode={episode}
        source={source}
        offset={offset}
        defaultOffset={defaultOffset}
        furigana={furigana}
        showEn={showEn}
        showSync={showSync}
        selected={selected}
        statusOf={statusOf}
        onWordTap={handleWordTap}
        onOffsetChange={setOffset}
        onToggleFurigana={() => setFurigana((f) => !f)}
        onToggleEn={() => setShowEn((s) => !s)}
        onToggleSync={() => setShowSync((s) => !s)}
        seekRef={seekRef}
        onActiveLineChange={onActiveLineChange}
        clipSegment={clipSegment}
      />

      {selected && (
        <DictionaryCard
          selection={selected}
          knowledge={knowledge}
          encounter={vocabulary[selected.tok.dict]}
          episodeId={source.episodeId}
          onAdd={() => addToDeck(selected.tok, selected.line)}
          onClose={() => setSelected(null)}
          onJumpToFirst={() => {
            const clip = vocabulary[selected.tok.dict]?.firstClip;
            if (clip) navigate(`/watch/${encodeURIComponent(clip.episodeId)}`);
          }}
        />
      )}

      <Transcript
        lines={episode.lines}
        activeLineId={activeLineId}
        offset={offset}
        onJump={jumpToLine}
      />

      <DeckPanel
        deck={deck}
        vocabulary={vocabulary}
        dueCount={dueCards.length}
        kanjiDueCount={dueKanji.length}
        onReview={() => setReviewing(true)}
        onReviewKanji={() => setReviewingKanji(true)}
      />

      {reviewing && (
        <ReviewModal
          cards={dueCards}
          onGrade={(dict, good) =>
            setKnowledge((k) => {
              const entry = k[dict];
              return entry ? { ...k, [dict]: { ...entry, status: good ? "known" : "learning" } } : k;
            })
          }
          onClose={() => {
            setReviewing(false);
            if (!reviewedOnce) {
              setReviewedOnce(true);
              markStepComplete("review", source.episodeId);
            }
          }}
        />
      )}

      {reviewingKanji && (
        <KanjiReviewModal
          cards={dueKanji}
          progress={kanjiProgress}
          onGrade={(char, good) => {
            setKanjiCards((cards) => {
              const card = cards[char];
              if (!card) return cards;
              const next = { ...cards, [char]: gradeKanjiCard(card, good) };
              saveKanjiCards(next);
              return next;
            });
            void postKanjiReview(char, good, getDeviceId());
          }}
          onClose={() => setReviewingKanji(false)}
        />
      )}
    </div>
  );
}
