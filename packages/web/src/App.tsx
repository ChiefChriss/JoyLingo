import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { EpisodeSource } from "@joylingo/player-core";
import { fetchManifest } from "./lib/episodes";
import { isOnboardingComplete, loadProfile, saveProfile } from "./lib/profile";
import { SiteNav } from "./components/SiteNav";

const Home = lazy(() => import("./components/Home").then((m) => ({ default: m.Home })));
const ImmersionPlayer = lazy(() =>
  import("./components/ImmersionPlayer").then((m) => ({ default: m.ImmersionPlayer })),
);
const KanaTools = lazy(() => import("./components/KanaTools").then((m) => ({ default: m.KanaTools })));
const KanjiDashboard = lazy(() =>
  import("./components/KanjiDashboard").then((m) => ({ default: m.KanjiDashboard })),
);
const CurriculumPage = lazy(() =>
  import("./components/CurriculumPage").then((m) => ({ default: m.CurriculumPage })),
);
const SkillLevelTest = lazy(() =>
  import("./components/SkillLevelTest").then((m) => ({ default: m.SkillLevelTest })),
);
const EduLessonView = lazy(() =>
  import("./components/EduLessonView").then((m) => ({ default: m.EduLessonView })),
);
const EduCurriculumOverview = lazy(() =>
  import("./components/EduCurriculumOverview").then((m) => ({ default: m.EduCurriculumOverview })),
);
const OnboardingWizard = lazy(() =>
  import("./components/OnboardingWizard").then((m) => ({ default: m.OnboardingWizard })),
);
const SettingsPage = lazy(() =>
  import("./components/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

const WATCH_EPISODE_RE = /^\/watch\/([^/]+)$/;

function parseClipSegment(search: string) {
  const params = new URLSearchParams(search);
  const line = params.get("line");
  const clipStart = params.get("clipStart");
  const clipEnd = params.get("clipEnd");
  if (!line || !clipStart || !clipEnd) return null;
  const start = Number(clipStart);
  const end = Number(clipEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    lineId: line,
    clipStart: start,
    clipEnd: end,
    autoplay: params.get("autoplay") === "1",
  };
}

function PageFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="ip-root">
      <div className="ip-loading">{label}</div>
    </div>
  );
}

/**
 * Minimal history-API router:
 *   /                 → home (recommendations + paste-URL)
 *   /curriculum       → Genki/Tobira lessons + immersion goals
 *   /curriculum/placement → skill level assessment
 *   /curriculum/lesson/:slug → individual lesson
 *   /learn/kana        → hiragana & katakana chart + quiz
 *   /kanji             → kanji from your encountered words
 *   /watch/:episodeId → immersion player
 *   /watch?v=VIDEO_ID → shared-link redirect (lookup → player or attach flow)
 * React Router lands if routes keep growing.
 */
function useLocationState(): { path: string; search: string } {
  const [loc, setLoc] = useState({
    path: window.location.pathname,
    search: window.location.search,
  });
  useEffect(() => {
    const onPop = () =>
      setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return loc;
}

export function navigate(to: string): void {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function App() {
  const { path, search } = useLocationState();
  const [sources, setSources] = useState<EpisodeSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setSources(await fetchManifest());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Onboarding gate: redirect `/` → `/onboarding` when not complete.
  // Skips the redirect for deep links (player, kanji, kana) so users can
  // resume a shared `/watch/...` link without being forced into onboarding.
  useEffect(() => {
    if (path === "/onboarding") return;
    const onWatch = WATCH_EPISODE_RE.test(path) || path === "/watch";
    if (onWatch || path === "/learn/kana" || path === "/kanji" || path.startsWith("/curriculum")) return;
    if (!isOnboardingComplete()) navigate("/onboarding");
  }, [path]);

  if (error) return <div className="ip-root"><div className="ip-error">{error}</div></div>;
  if (!sources) return <PageFallback />;

  if (path === "/onboarding") {
    return (
      <Suspense fallback={<PageFallback label="Loading onboarding…" />}>
        <OnboardingWizard
          onComplete={(next) => {
            saveProfile(next);
            setProfileVersion((v) => v + 1);
            navigate("/");
          }}
        />
      </Suspense>
    );
  }

  if (path === "/learn/kana") {
    return (
      <Suspense fallback={<PageFallback label="Loading kana tools…" />}>
        <KanaTools />
      </Suspense>
    );
  }

  if (path === "/curriculum") {
    return (
      <Suspense fallback={<PageFallback label="Loading curriculum…" />}>
        <CurriculumPage />
      </Suspense>
    );
  }

  if (path === "/curriculum/placement") {
    return (
      <Suspense fallback={<PageFallback label="Loading placement test…" />}>
        <div className="ip-root ip-home ip-curriculum-page">
          <SiteNav active="curriculum" />
          <SkillLevelTest />
        </div>
      </Suspense>
    );
  }

  if (path === "/curriculum/overview") {
    return (
      <Suspense fallback={<PageFallback label="Loading overview…" />}>
        <EduCurriculumOverview />
      </Suspense>
    );
  }

  const lessonMatch = /^\/curriculum\/lesson\/([^/]+)$/.exec(path);
  if (lessonMatch) {
    return (
      <Suspense fallback={<PageFallback label="Loading lesson…" />}>
        <EduLessonView slug={decodeURIComponent(lessonMatch[1]!)} />
      </Suspense>
    );
  }

  if (path === "/kanji") {
    return (
      <Suspense fallback={<PageFallback label="Loading kanji…" />}>
        <KanjiDashboard />
      </Suspense>
    );
  }

  if (path === "/settings") {
    return (
      <Suspense fallback={<PageFallback label="Loading settings…" />}>
        <SettingsPage />
      </Suspense>
    );
  }

  const watchMatch = WATCH_EPISODE_RE.exec(path);
  if (watchMatch) {
    const source = sources.find((s) => s.episodeId === decodeURIComponent(watchMatch[1]!));
    if (!source) {
      return (
        <div className="ip-root">
          <div className="ip-error">
            Unknown episode "{watchMatch[1]}".{" "}
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Back to catalog</a>
          </div>
        </div>
      );
    }
    return (
      <Suspense fallback={<PageFallback label="Loading player…" />}>
        <ImmersionPlayer
          key={source.episodeId}
          source={source}
          clipSegment={parseClipSegment(search)}
        />
      </Suspense>
    );
  }

  // /watch?v=VIDEO_ID (shared link) → home runs the paste flow for it.
  const videoParam =
    path === "/watch" || path === "/" ? new URLSearchParams(search).get("v") : null;

  // If onboarding isn't done and the user somehow lands on `/`, bounce them
  // to the wizard before rendering the catalog.
  if (path === "/" && !isOnboardingComplete()) {
    return (
      <Suspense fallback={<PageFallback label="Loading onboarding…" />}>
        <OnboardingWizard
          onComplete={(next) => {
            saveProfile(next);
            setProfileVersion((v) => v + 1);
            navigate("/");
          }}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Home
        key={profileVersion}
        sources={sources}
        onRefresh={refresh}
        initialVideoId={videoParam}
        profile={loadProfile()}
      />
    </Suspense>
  );
}
