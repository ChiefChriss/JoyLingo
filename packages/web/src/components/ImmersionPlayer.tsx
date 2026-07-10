import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import type { Episode, Line, WordToken } from "@joylingo/shared";
import {
  HtmlVideoPlayerAdapter,
  MockPlayerAdapter,
  YouTubePlayerAdapter,
  usePlaybackClock,
  findActiveLine,
  mineEntry,
  toDeck,
  wordClipBounds,
  type ReviewDeckCard,
  recordEncounter,
  markMined,
  mergeVocabularyMaps,
  attachWordReviewClips,
  dueKanjiCards,
  gradeKanjiCard,
  gradeWordCard,
  isWordDue,
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
  listPlayableStreamSources,
  patchSubtitleOffset,
  streamQualityLabel,
  streamSourceKey,
  type VideoLink,
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
  onVocabularyHydrated,
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
import { SubtitleProvenance } from "./SubtitleProvenance";
import { LocalVideoPicker } from "./LocalVideoPicker";

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
  clipStart?: number;
  clipEnd?: number;
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
  const [streamRetryKey, setStreamRetryKey] = useState(0);
  const [streamSources, setStreamSources] = useState<VideoLink[]>([]);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  /** Session-scoped File only — blob URL created in bind effect; never persisted/uploaded. */
  const [localFile, setLocalFile] = useState<File | null>(null);

  const { youtubeVideoId, animeStream } = source;
  const useWideSync = Boolean(localFile || animeStream);
  const syncMin = useWideSync ? -300 : -10;
  const syncMax = useWideSync ? 300 : 10;

  // Drop local override when switching episodes or when YouTube is bound.
  useEffect(() => {
    setLocalFile(null);
  }, [source.episodeId, youtubeVideoId]);

  const pickLocalFile = useCallback((file: File) => {
    setLocalFile(file);
    setPlayerError(null);
  }, []);

  const clearLocalFile = useCallback(() => {
    setLocalFile(null);
  }, []);

  // Resolve playable CDN sources (re-run on retry). Skip when local file overrides.
  useEffect(() => {
    if (!animeStream || localFile) {
      setStreamSources([]);
      setSelectedSourceKey(null);
      return;
    }

    let cancelled = false;
    setStreamLoading(true);
    setPlayerError(null);
    setStreamSources([]);
    setSelectedSourceKey(null);

    void (async () => {
      try {
        const raw = await fetchStreamSources(
          animeStream.showId,
          animeStream.episode,
          animeStream.mode,
          animeStream.malId,
        );
        if (cancelled) return;
        const playable = await listPlayableStreamSources(raw);
        if (playable.length === 0) {
          throw new Error("Stream unavailable — sources did not respond");
        }
        setStreamSources(playable);
        setSelectedSourceKey(streamSourceKey(playable[0]!));
      } catch (err) {
        if (!cancelled) {
          const raw = err instanceof Error ? err.message : "Stream load failed";
          setPlayerError(
            /no sources found/i.test(raw)
              ? "Couldn’t resolve a playable stream for this episode"
              : raw,
          );
        }
      } finally {
        if (!cancelled) setStreamLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    animeStream?.showId,
    animeStream?.episode,
    animeStream?.mode,
    animeStream?.malId,
    streamRetryKey,
    localFile,
  ]);

  // Bind player: YouTube → local blob → anime stream → mock.
  // Blob URL is created+revoked here so bind never sees a revoked src.
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

    if (localFile) {
      if (!videoEl) return;
      setAdapter(null);
      const blobUrl = URL.createObjectURL(localFile);
      videoEl.src = blobUrl;
      videoEl.load();
      const a = new HtmlVideoPlayerAdapter(videoEl, (err) => setPlayerError(err.message));
      setAdapter(a);
      return () => {
        a.destroy();
        setAdapter(null);
        videoEl.removeAttribute("src");
        videoEl.load();
        URL.revokeObjectURL(blobUrl);
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

    if (!selectedSourceKey) return;

    const source = streamSources.find((s) => streamSourceKey(s) === selectedSourceKey);
    if (!source) return;

    setAdapter(null);
    const proxiedUrl = buildProxyUrl(source.url, source.referer);
    const isHls =
      source.isHls === true ||
      source.url.includes(".m3u8") ||
      source.url.includes("m3u8");
    let hls: Hls | null = null;

    // On unrecoverable errors, hop to the next source instead of looping
    // recoverMediaError() forever (which shows as playback cutting in/out).
    const advanceToNextSource = (details: string) => {
      const index = streamSources.findIndex(
        (s) => streamSourceKey(s) === selectedSourceKey,
      );
      const next = streamSources[index + 1];
      if (next) {
        setSelectedSourceKey(streamSourceKey(next));
      } else {
        setPlayerError(`Video playback failed (${details})`);
      }
    };

    if (isHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(proxiedUrl);
      hls.attachMedia(videoEl);
      let networkRetries = 0;
      let mediaRecoveries = 0;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (networkRetries < 3) {
            networkRetries += 1;
            hls?.startLoad();
          } else {
            advanceToNextSource(data.details);
          }
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRecoveries >= 2) {
            advanceToNextSource(data.details);
            return;
          }
          mediaRecoveries += 1;
          // Codec rejected by MediaSource (e.g. HE-AAC signalled as
          // mp4a.40.1) — try the alternate audio codec signature.
          if (
            data.details === Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR ||
            data.details === Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR
          ) {
            hls?.swapAudioCodec();
          }
          hls?.recoverMediaError();
          return;
        }
        advanceToNextSource(data.details);
      });
    } else if (
      isHls &&
      videoEl.canPlayType("application/vnd.apple.mpegurl")
    ) {
      videoEl.src = proxiedUrl;
      videoEl.load();
    } else if (isHls) {
      setPlayerError("HLS playback is not supported in this browser");
      return;
    } else {
      videoEl.src = proxiedUrl;
      videoEl.load();
    }

    const a = new HtmlVideoPlayerAdapter(videoEl, (err) => {
      // hls.js owns error handling for HLS. For direct files, a dead link
      // (expired token, 401) fires the element's error event — fall through
      // to the next source. Autoplay rejections etc. still surface as text.
      if (!hls && err.message === "Video playback failed") {
        advanceToNextSource(err.message);
      } else {
        setPlayerError(err.message);
      }
    });
    setAdapter(a);

    return () => {
      hls?.destroy();
      a.destroy();
      setAdapter(null);
    };
  }, [
    episode.duration,
    youtubeVideoId,
    localFile,
    animeStream,
    videoEl,
    selectedSourceKey,
    streamSources,
  ]);

  const hasVideo = Boolean(youtubeVideoId || localFile || animeStream);

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
    clipStartedRef.current = false;
  }, [clipSegment?.lineId, clipSegment?.clipStart, clipSegment?.clipEnd, clipSegment?.autoplay]);

  useEffect(() => {
    if (!clipSegment || !adapter || clipStartedRef.current) return;
    const line = episode.lines.find((l) => l.id === clipSegment.lineId);
    if (!line) return;
    clipStartedRef.current = true;
    let start = clipSegment.clipStart;
    let end = clipSegment.clipEnd;
    if (start == null || end == null) {
      start = Math.max(0, line.start - 0.3);
      end = line.end + 0.3;
    }
    const seekTo = start + offset;
    clock.seek(seekTo);
    onActiveLineChange(clipSegment.lineId);
    if (clipSegment.autoplay) adapter.play();
  }, [clipSegment, adapter, offset, clock, onActiveLineChange, episode.lines]);

  useEffect(() => {
    if (!clipSegment || !adapter) return;
    const line = episode.lines.find((l) => l.id === clipSegment.lineId);
    if (!line) return;
    let end = clipSegment.clipEnd;
    if (end == null) end = line.end + 0.3;
    const pauseAt = end + offset;
    if (clock.currentTime >= pauseAt && adapter.isPlaying()) {
      adapter.pause();
    }
  }, [clock.currentTime, clipSegment, offset, adapter, episode.lines]);

  const seekFraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    clock.seek(frac * duration);
  };

  const frameRef = useRef<HTMLDivElement | null>(null);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void frameRef.current?.requestFullscreen();
    }
  }, []);

  /** Custom controls overlaid on the <video> — replaces native browser controls. */
  const videoHud = (
    <div className="ip-video-hud">
      <div className="ip-video-time">
        {formatTime(clock.currentTime)} / {formatTime(duration)}
      </div>
      {!clock.playing && !streamLoading && (
        <div className="ip-video-center">
          <button
            className="ip-playbtn"
            onClick={(e) => { e.stopPropagation(); clock.toggle(); }}
            aria-label="Play"
          >
            ▶
          </button>
        </div>
      )}
      <button
        className="ip-video-fullscreen"
        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
        aria-label="Toggle fullscreen"
      >
        ⛶
      </button>
    </div>
  );

  return (
    <>
      <div className="ip-player" ref={frameRef}>
        {youtubeVideoId ? (
          <div className="ip-yt-frame">
            <div id={YT_MOUNT_ID} />
            {playerError && <div className="ip-player-error">{playerError}</div>}
          </div>
        ) : localFile ? (
          <div className="ip-yt-frame ip-anime-frame" onClick={clock.toggle}>
            <video
              ref={(el) => {
                videoRef.current = el;
                setVideoEl(el);
              }}
              className="ip-anime-video"
              playsInline
              preload="auto"
            />
            {videoHud}
            {playerError && <div className="ip-player-error">{playerError}</div>}
          </div>
        ) : animeStream ? (
          <div className="ip-yt-frame ip-anime-frame" onClick={clock.toggle}>
            {streamSources.length > 1 && (
              <div className="ip-stream-quality" onClick={(e) => e.stopPropagation()}>
                <label className="ip-stream-quality-label">
                  Quality
                  <select
                    className="ip-stream-quality-select"
                    value={selectedSourceKey ?? ""}
                    disabled={streamLoading || !selectedSourceKey}
                    onChange={(e) => setSelectedSourceKey(e.target.value)}
                  >
                    {streamSources.map((s) => (
                      <option key={streamSourceKey(s)} value={streamSourceKey(s)}>
                        {streamQualityLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <video
              ref={(el) => {
                videoRef.current = el;
                setVideoEl(el);
              }}
              className="ip-anime-video"
              playsInline
              preload="auto"
            />
            {videoHud}
            {streamLoading && <div className="ip-player-loading">Loading stream…</div>}
            {playerError && (
              <div className="ip-player-error" onClick={(e) => e.stopPropagation()}>
                <p>{playerError}</p>
                <p className="ip-player-error-hint">
                  Stream catalog is unavailable right now — use Open local video below,
                  or go back and pick a YouTube episode.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={streamLoading}
                  onClick={() => {
                    setPlayerError(null);
                    setStreamRetryKey((k) => k + 1);
                  }}
                >
                  Re-resolve stream
                </button>
              </div>
            )}
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
                {clock.playing
                  ? ""
                  : "mock player — open a local video file, or bind youtubeVideoId / animeStream"}
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

      {!youtubeVideoId && (
        <LocalVideoPicker
          fileName={localFile?.name ?? null}
          onPick={pickLocalFile}
          onClear={clearLocalFile}
        />
      )}

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
              ? useWideSync
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
              {useWideSync && (
                <span className="ip-sync-hint">
                  {" "}
                  — local / anime files often need ±60–120s
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
  const [inlineClip, setInlineClip] = useState<ClipSegmentOptions | null>(null);
  const defaultOffset = source.subtitleOffset ?? 0;
  const [offset, setOffset] = useState(
    () => loadStoredOffset(source.episodeId) ?? defaultOffset,
  );
  const [showSync, setShowSync] = useState(() => Boolean(source.animeStream));
  const seekRef = useRef<(seconds: number) => void>(() => {});

  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [watchedOnce, setWatchedOnce] = useState(false);
  const [reviewedOnce, setReviewedOnce] = useState(false);
  const vocabPersistReady = useRef(false);

  useEffect(
    () =>
      onVocabularyHydrated((merged) => {
        setVocabulary((prev) => mergeVocabularyMaps(prev, merged));
        setKanjiCards(loadKanjiCards());
      }),
    [],
  );

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
    if (!vocabPersistReady.current) {
      vocabPersistReady.current = true;
      return;
    }
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
  const dueCards = useMemo((): ReviewDeckCard[] => {
    return deck
      .filter((c) => isWordDue(c))
      .map((card) => attachWordReviewClips(card, vocabulary[card.dict], episode, source.episodeId));
  }, [deck, vocabulary, episode, source.episodeId]);
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
          <SubtitleProvenance source={source} episode={episode} />
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
        clipSegment={inlineClip ?? clipSegment ?? null}
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
          currentEpisodeId={source.episodeId}
          onPlayClip={(clip) => {
            if (clip.episodeId === source.episodeId) {
              setInlineClip({
                lineId: clip.lineId,
                clipStart: clip.clipStart,
                clipEnd: clip.clipEnd,
                autoplay: true,
              });
              return;
            }
          }}
          onGrade={(dict, good) =>
            setKnowledge((k) => {
              const entry = k[dict];
              return entry ? { ...k, [dict]: gradeWordCard(entry, good) } : k;
            })
          }
          onClose={() => {
            setReviewing(false);
            setInlineClip(null);
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
