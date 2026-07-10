import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import type { EpisodeSource } from "@joylingo/player-core";
import type { UserProfile, VocabularyMap } from "@joylingo/shared";
import {
  listEpisodesForAnime,
  lookupByYoutubeId,
  parseYoutubeVideoId,
} from "../lib/api";
import { loadVocabulary, mergeVocabularyMaps, onVocabularyHydrated } from "../lib/vocabulary";
import { markStepComplete } from "../lib/curriculum";
import type { AnimeLearnModalProps } from "./AnimeLearnModal";
import { navigate } from "../App";
import { SiteNav } from "./SiteNav";
import { ModalPortal } from "./ModalPortal";

const AttachSubtitlesModal = lazy(() =>
  import("./AttachSubtitlesModal").then((m) => ({ default: m.AttachSubtitlesModal })),
);
const AnimeLearnModal = lazy(() =>
  import("./AnimeLearnModal").then((m) => ({ default: m.AnimeLearnModal })),
);
const CurriculumPath = lazy(() =>
  import("./CurriculumPath").then((m) => ({ default: m.CurriculumPath })),
);
const HomeClipsSection = lazy(() =>
  import("./HomeClipsSection").then((m) => ({ default: m.HomeClipsSection })),
);
const HomeFusionReview = lazy(() =>
  import("./HomeFusionReview").then((m) => ({ default: m.HomeFusionReview })),
);

interface Props {
  sources: EpisodeSource[];
  /** Re-fetch the catalog (after an import adds an episode). */
  onRefresh: () => Promise<void>;
  /** From a /watch?v=VIDEO_ID share link — run the paste flow immediately. */
  initialVideoId?: string | null;
  /** Device-local user profile (passed by App after onboarding). */
  profile: UserProfile;
}

export function Home({ sources, onRefresh, initialVideoId, profile }: Props) {
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [attachVideoId, setAttachVideoId] = useState<string | null>(null);
  const [showAnimeModal, setShowAnimeModal] = useState(false);
  const [animeModalPrefill, setAnimeModalPrefill] =
    useState<AnimeLearnModalProps["prefill"]>(null);
  const [vocabulary, setVocabulary] = useState<VocabularyMap>(() => loadVocabulary());
  const [favoriteEpisodes, setFavoriteEpisodes] = useState<Record<number, EpisodeSource[]>>({});

  useEffect(
    () => onVocabularyHydrated((merged) => setVocabulary((prev) => mergeVocabularyMaps(prev, merged))),
    [],
  );

  const openAnimePicker = (prefill?: AnimeLearnModalProps["prefill"]) => {
    setAnimeModalPrefill(prefill ?? null);
    setShowAnimeModal(true);
  };

  useEffect(() => {
    if (!showAnimeModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAnimeModal]);

  // Parallel fetch for favorite anime episodes (async-parallel).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        profile.favoriteAnime.map(async (fav) => {
          const eps = await listEpisodesForAnime(fav.malId);
          return [fav.malId, eps] as const;
        }),
      );
      if (!cancelled) setFavoriteEpisodes(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.favoriteAnime]);

  const openVideo = async (videoId: string) => {
    setBusy(true);
    setPasteError(null);
    try {
      const hit = await lookupByYoutubeId(videoId);
      if (hit) navigate(`/watch/${encodeURIComponent(hit.episodeId)}`);
      else setAttachVideoId(videoId);
    } catch {
      setPasteError("Catalog lookup failed — is the API running? (npm run api)");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialVideoId) void openVideo(initialVideoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoId]);

  const submitPaste = () => {
    const videoId = parseYoutubeVideoId(paste);
    if (!videoId) {
      setPasteError("That doesn't look like a YouTube link or video id.");
      return;
    }
    void openVideo(videoId);
  };

  const { featured, rest } = useMemo(() => {
    const featured: EpisodeSource[] = [];
    const rest: EpisodeSource[] = [];
    for (const s of sources) {
      if (s.featured) featured.push(s);
      else rest.push(s);
    }
    return { featured, rest };
  }, [sources]);

  const heroSubtitle = profile.favoriteAnime.length > 0
    ? `Continue with ${profile.favoriteAnime.length} anime on your path — mine vocabulary from episodes and review with spaced repetition.`
    : "Pick anime you love, watch with interactive furigana, and build vocabulary from what you hear.";

  return (
    <div className="ip-root ip-home">
      <SiteNav active="home" />

      <section className="ip-hero">
        <div className="ip-hero-glow" aria-hidden />
        <div className="ip-hero-content">
          <div className="ip-eyebrow">Immersion learning</div>
          <h1 className="ip-hero-title">
            Learn Japanese from{" "}
            <span className="ip-hero-accent">anime you love</span>
          </h1>
          <p className="ip-hero-sub">{heroSubtitle}</p>
          {profile.jlptGoal && profile.jlptGoal !== "anime_only" && (
            <div className="ip-hero-badges">
              <span className="chip chip-amber">Goal: {profile.jlptGoal}</span>
              <span className="chip">{profile.preferredStreamMode === "sub" ? "Sub mode" : "Dub mode"}</span>
            </div>
          )}
        </div>
      </section>

      <Suspense fallback={<div className="ip-loading">Loading your path…</div>}>
        <CurriculumPath
          profile={profile}
          vocabulary={vocabulary}
          onPickEpisode={() => {
            const first = profile.favoriteAnime[0];
            openAnimePicker(
              first ? { malId: first.malId, title: first.title } : null,
            );
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <HomeFusionReview />
      </Suspense>

      <Suspense fallback={null}>
        <HomeClipsSection profile={profile} />
      </Suspense>

      {profile.favoriteAnime.length > 0 && (
        <section className="ip-home-section">
          <div className="ip-section-head">
            <div className="ip-section-label">Your anime</div>
            <span className="chip">{profile.favoriteAnime.length} picked</span>
          </div>
          <div className="ip-catalog ip-catalog-anime">
            {profile.favoriteAnime.map((fav) => {
              const eps = favoriteEpisodes[fav.malId] ?? [];
              const last = eps[0];
              return (
                <article key={fav.malId} className="ip-anime-card">
                  {fav.coverImageURL ? (
                    <img className="ip-anime-cover" src={fav.coverImageURL} alt="" />
                  ) : (
                    <div className="ip-anime-cover" style={{ background: "var(--panel2)" }} />
                  )}
                  <div className="ip-anime-card-body">
                    <div className="ip-anime-card-title" lang="ja">{fav.title}</div>
                    <div className="ip-anime-card-actions">
                      {last ? (
                        <button
                          className="btn-primary"
                          onClick={() => navigate(`/watch/${encodeURIComponent(last.episodeId)}`)}
                        >
                          Continue
                        </button>
                      ) : (
                        <span className="chip">No episodes yet</span>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          openAnimePicker({ malId: fav.malId, title: fav.title })
                        }
                      >
                        Pick episode
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="ip-home-section">
        <div className="ip-section-label">Learning tools</div>
        <div className="ip-bento">
          <button type="button" className="ip-bento-card" onClick={() => navigate("/kanji")}>
            <span className="ip-bento-icon" lang="ja">漢字</span>
            <span className="ip-bento-title">Kanji dashboard</span>
            <span className="ip-bento-desc">
              Characters from words you&apos;ve looked up while watching
            </span>
            <span className="chip">From your media</span>
          </button>
          <button type="button" className="ip-bento-card" onClick={() => navigate("/learn/kana")}>
            <span className="ip-bento-icon" lang="ja">あ</span>
            <span className="ip-bento-title">Kana chart &amp; quiz</span>
            <span className="ip-bento-desc">
              Full hiragana &amp; katakana with romaji quiz
            </span>
            <span className="chip">104 chars each</span>
          </button>
        </div>
      </section>

      <section className="ip-cta-card">
        <div className="ip-section-label">Learn from anime</div>
        <p className="ip-paste-hint">
          Search any anime, pick an episode, load Jimaku fan subs, and study
          with interactive furigana and vocabulary mining.
        </p>
        <button type="button" className="btn-primary" onClick={() => openAnimePicker()}>
          Choose anime episode
        </button>
      </section>

      <section className="ip-paste">
        <div className="ip-section-label">Watch any YouTube video</div>
        <div className="ip-paste-row">
          <input
            value={paste}
            placeholder="Paste a YouTube URL…"
            onChange={(e) => setPaste(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPaste()}
          />
          <button className="btn-primary" disabled={busy || !paste.trim()} onClick={submitPaste}>
            {busy ? "Looking up…" : "Watch"}
          </button>
        </div>
        {pasteError && <div className="ip-attach-error">{pasteError}</div>}
        <div className="ip-paste-hint">
          Already enriched → plays instantly. New video → JoyLingo checks YouTube
          captions first, then Jimaku if needed.
        </div>
      </section>

      {featured.length > 0 && (
        <section className="ip-home-section">
          <div className="ip-section-label">Start here</div>
          <CatalogList sources={featured} />
        </section>
      )}

      {rest.length > 0 && (
        <section className="ip-home-section">
          <div className="ip-section-label">
            {featured.length > 0 ? "Recently added" : "All episodes"}
          </div>
          <CatalogList sources={rest} />
        </section>
      )}

      {attachVideoId && (
        <Suspense fallback={null}>
          <AttachSubtitlesModal
            videoId={attachVideoId}
            onClose={() => setAttachVideoId(null)}
            onImported={async (episodeId) => {
              await onRefresh();
              setAttachVideoId(null);
              navigate(`/watch/${encodeURIComponent(episodeId)}`);
            }}
          />
        </Suspense>
      )}

      {showAnimeModal && (
        <Suspense
          fallback={
            <ModalPortal>
              <div className="ip-modal-backdrop">
                <div className="ip-modal">
                  <div className="ip-loading">Opening episode picker…</div>
                </div>
              </div>
            </ModalPortal>
          }
        >
          <AnimeLearnModal
            key={animeModalPrefill ? `pick-${animeModalPrefill.malId}` : "search"}
            prefill={animeModalPrefill}
            onClose={() => {
              setShowAnimeModal(false);
              setAnimeModalPrefill(null);
            }}
            onImported={async (episodeId) => {
              await onRefresh();
              setShowAnimeModal(false);
              setAnimeModalPrefill(null);
              markStepComplete("immersion", episodeId);
              setVocabulary(loadVocabulary());
              navigate(`/watch/${encodeURIComponent(episodeId)}`);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

const CatalogList = memo(function CatalogList({ sources }: { sources: EpisodeSource[] }) {
  return (
    <div className="ip-catalog">
      {sources.map((s) => (
        <button
          key={s.episodeId}
          className="ip-catalog-item"
          onClick={() => navigate(`/watch/${encodeURIComponent(s.episodeId)}`)}
        >
          <span className="ip-catalog-title" lang="ja">{s.title}</span>
          {s.titleEn && <span className="ip-catalog-en">{s.titleEn}</span>}
          <span className="chip">
            {s.animeStream ? "anime" : s.youtubeVideoId ? "YouTube" : "mock player"}
          </span>
        </button>
      ))}
    </div>
  );
});
