import { useEffect, useRef, useState } from "react";
import { ModalPortal } from "./ModalPortal";
import {
  fetchStreamBootstrap,
  getImportJob,
  listJimakuFiles,
  lookupByAnime,
  searchJimaku,
  startImport,
  type AnimeSummary,
  type JimakuEntry,
  type JimakuFile,
  type StreamBootstrap,
} from "../lib/api";
import { AnimeSearchPicker } from "./AnimeSearchPicker";
import { loadProfile } from "../lib/profile";

interface Prefill {
  malId: number;
  title: string;
}

export interface AnimeLearnModalProps {
  onClose: () => void;
  onImported: (episodeId: string) => void;
  /** When opened from Home "Pick episode", pre-fill this anime. */
  prefill?: Prefill | null;
}

interface Props {
  onClose: () => void;
  onImported: (episodeId: string) => void;
  prefill?: Prefill | null;
}

const POLL_MS = 1500;

type Step = "search" | "episode" | "subs";

function displayTitle(a: AnimeSummary): string {
  return a.english ?? a.romaji;
}

/** Best query for Jimaku — native title usually matches fan-sub entries. */
function jimakuSearchQuery(anime: AnimeSummary, streamName?: string | null): string {
  return (
    anime.native?.trim() ||
    anime.english?.trim() ||
    streamName?.trim() ||
    anime.romaji.trim()
  );
}

function episodeNumber(raw: string): number {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 0 : Math.floor(n);
}

export function AnimeLearnModal({ onClose, onImported, prefill }: Props) {
  const [step, setStep] = useState<Step>(prefill ? "episode" : "search");
  const [anime, setAnime] = useState<AnimeSummary | null>(null);
  const [stream, setStream] = useState<StreamBootstrap | null>(null);
  const [selectedEp, setSelectedEp] = useState<string | null>(null);
  const [mode, setMode] = useState<"sub" | "dub">(
    () => loadProfile().preferredStreamMode,
  );

  const [jimakuQuery, setJimakuQuery] = useState("");
  const [entries, setEntries] = useState<JimakuEntry[] | null>(null);
  const [entry, setEntry] = useState<JimakuEntry | null>(null);
  const [files, setFiles] = useState<JimakuFile[] | null>(null);
  const [jaFile, setJaFile] = useState<JimakuFile | null>(null);
  const [enFile, setEnFile] = useState<JimakuFile | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrapGen = useRef(0);

  const bootstrapPrefill = async (target: Prefill, gen: number) => {
    const synthetic: AnimeSummary = {
      malId: target.malId,
      romaji: target.title,
      english: target.title,
      native: target.title,
      coverImageURL: null,
      episodes: null,
      score: null,
    };
    setBusy(true);
    setError(null);
    setStep("episode");
    try {
      const boot = await fetchStreamBootstrap({
        malId: target.malId,
        mode,
        fallbackTitles: [target.title],
      });
      if (gen !== bootstrapGen.current) return;
      if (!boot.match && boot.episodes.length === 0) {
        throw new Error("No stream source found for this anime");
      }
      setAnime(synthetic);
      setStream(boot);
      setJimakuQuery(jimakuSearchQuery(synthetic, boot.match?.name));
    } catch (e) {
      if (gen !== bootstrapGen.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === bootstrapGen.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      try {
        const job = await getImportJob(jobId);
        setJobStatus(job.status);
        if (job.status === "done" && job.episodeId) {
          clearInterval(timer);
          onImported(job.episodeId);
        } else if (job.status === "error") {
          clearInterval(timer);
          setJobId(null);
          setError(job.error ?? "Enrichment failed");
        }
      } catch {
        /* keep polling */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [jobId, onImported]);

  // Prefill path: skip search and bootstrap episodes for the picked anime.
  useEffect(() => {
    if (!prefill) return;
    const gen = ++bootstrapGen.current;
    void bootstrapPrefill(prefill, gen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.malId]);

  const retryPrefill = () => {
    if (!prefill) return;
    const gen = ++bootstrapGen.current;
    void bootstrapPrefill(prefill, gen);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickAnime = (a: AnimeSummary) =>
    run(async () => {
      setAnime(a);
      setSelectedEp(null);
      setStream(null);
      setStep("episode");
      const boot = await fetchStreamBootstrap({
        malId: a.malId,
        mode,
        fallbackTitles: [a.english, a.romaji, a.native].filter(Boolean) as string[],
      });
      setJimakuQuery(jimakuSearchQuery(a, boot.match?.name));
      if (!boot.match && boot.episodes.length === 0) {
        throw new Error("No stream source found for this anime");
      }
      setStream(boot);
      setStep("episode");
    });

  const pickEpisode = (ep: string) =>
    run(async () => {
      if (!anime || !stream?.match) return;

      const cached = await lookupByAnime(anime.malId, ep, mode);
      if (cached) {
        onImported(cached.episodeId);
        return;
      }

      const q = jimakuSearchQuery(anime, stream.match.name);
      setSelectedEp(ep);
      setEntry(null);
      setFiles(null);
      setJaFile(null);
      setEnFile(null);
      setJimakuQuery(q);
      setStep("subs");
      setEntries(await searchJimaku(q));
    });

  const searchSubs = () =>
    run(async () => {
      setEntry(null);
      setFiles(null);
      setEntries(await searchJimaku(jimakuQuery));
    });

  const pickEntry = (e: JimakuEntry) =>
    run(async () => {
      setEntry(e);
      setJaFile(null);
      setEnFile(null);
      const epNum = selectedEp ? episodeNumber(selectedEp) : undefined;
      const fileList = await listJimakuFiles(e.id, epNum || undefined);
      setFiles(fileList);
      if (fileList.length > 0) setJaFile(fileList[0]!);
    });

  const importEpisode = () =>
    run(async () => {
      if (!anime || !stream?.match || !selectedEp || !entry || !jaFile) return;
      setJobStatus("pending");
      setJobId(
        await startImport({
          title: `${displayTitle(anime)} · Ep ${selectedEp}`,
          titleEn: entry.english_name ?? displayTitle(anime),
          jimakuEntryId: entry.id,
          jaFileUrl: jaFile.url,
          jaFileName: jaFile.name,
          enFileUrl: enFile?.url,
          enFileName: enFile?.name,
          malId: anime.malId,
          showId: stream.match.id,
          animeEpisode: selectedEp,
          streamMode: mode,
        }),
      );
    });

  if (jobId) {
    return (
      <ModalPortal>
        <div className="ip-modal-backdrop">
          <div className="ip-modal">
            <div className="ip-modal-word">⏳</div>
            <div className="ip-modal-gloss">
              {jobStatus === "running" ? "Tokenizing… attaching glosses…" : "Fetching Jimaku subtitles…"}
            </div>
            <div className="ip-modal-note">Usually takes a few seconds.</div>
          </div>
        </div>
      </ModalPortal>
    );
  }

  const awaitingEpisodes = step === "episode" && (!anime || !stream);
  const displayName =
    prefill?.title ?? (anime ? displayTitle(anime) : null);

  return (
    <ModalPortal>
      <div
        className="ip-modal-backdrop"
        onClick={() => {
          if (!busy) onClose();
        }}
      >
      <div className="ip-modal ip-attach ip-anime-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ip-attach-head">
          <div>
            <div className="ip-section-label">Learn from anime</div>
            <div className="ip-anime-modal-title">
              {displayName ?? "Pick an episode"}
            </div>
            {!awaitingEpisodes && step === "search" && (
              <p className="ip-anime-modal-sub">
                Attach Jimaku subs and watch with interactive furigana
              </p>
            )}
          </div>
          <button className="ip-dict-close" onClick={onClose} disabled={busy} aria-label="Close">
            ✕
          </button>
        </div>

        {error && !awaitingEpisodes && <div className="ip-attach-error">{error}</div>}

        {awaitingEpisodes && (
          <EpisodePickerLoading title={displayName ?? "this anime"} busy={busy} />
        )}

        {prefill && error && !anime && !busy && (
          <div className="ip-anime-loading-error">
            <div className="ip-attach-error">{error}</div>
            <div className="ip-onboarding-actions">
              <button type="button" className="btn-primary" onClick={retryPrefill}>
                Retry
              </button>
              <button type="button" className="kana-link" onClick={() => setStep("search")}>
                Search for a different anime
              </button>
            </div>
          </div>
        )}

        {step === "search" && (
          <>
            <AnimeSearchPicker
              selected={anime ? new Set([anime.malId]) : new Set<number>()}
              onToggle={(a) => {
                if (anime?.malId === a.malId) return;
                void pickAnime(a);
              }}
              busy={busy}
            />
            {anime && busy && !stream && (
              <EpisodePickerLoading title={displayTitle(anime)} busy />
            )}
          </>
        )}

        {step === "episode" && anime && stream && (
          <>
            {!prefill && (
              <button type="button" className="ip-back" onClick={() => setStep("search")}>
                ← back to search
              </button>
            )}
            <div className="ip-anime-mode">
              <button
                className={"tool" + (mode === "sub" ? " on" : "")}
                onClick={() =>
                  run(async () => {
                    setMode("sub");
                    setStream(
                      await fetchStreamBootstrap({
                        malId: anime.malId,
                        mode: "sub",
                        fallbackTitles: [displayTitle(anime)],
                      }),
                    );
                  })
                }
              >
                Sub
              </button>
              <button
                className={"tool" + (mode === "dub" ? " on" : "")}
                onClick={() =>
                  run(async () => {
                    setMode("dub");
                    setStream(
                      await fetchStreamBootstrap({
                        malId: anime.malId,
                        mode: "dub",
                        fallbackTitles: [displayTitle(anime)],
                      }),
                    );
                  })
                }
              >
                Dub
              </button>
            </div>
            {!stream.match && (
              <div className="ip-attach-empty">No {mode} stream found for this title.</div>
            )}
            {stream.match && (
              <div className="ip-attach-list ip-anime-episodes">
                {stream.episodes.map((ep) => (
                  <button
                    key={ep}
                    type="button"
                    className="ip-attach-item"
                    disabled={busy}
                    onClick={() => pickEpisode(ep)}
                  >
                    <span className="ip-anime-ep-num">Ep {ep}</span>
                    <span className="ip-attach-sub">
                      {stream.titles[ep] ?? `Episode ${ep}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {busy && step === "episode" && anime && stream && (
              <div className="ip-paste-hint">Working…</div>
            )}
          </>
        )}

        {step === "subs" && anime && selectedEp && (
          <>
            <button className="ip-back" onClick={() => setStep("episode")}>
              ← back to episodes
            </button>
            <div className="ip-attach-video">
              {displayTitle(anime)} · Ep {selectedEp}
            </div>
            <div className="ip-attach-search">
              <input
                value={jimakuQuery}
                placeholder="Search Jimaku for subtitles…"
                onChange={(e) => setJimakuQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && jimakuQuery.trim() && searchSubs()}
              />
              <button
                className="btn-primary"
                disabled={busy || !jimakuQuery.trim()}
                onClick={searchSubs}
              >
                {entries ? "Search again" : "Search Jimaku"}
              </button>
            </div>
            {!entries && busy && (
              <div className="ip-attach-empty">Searching Jimaku for “{jimakuQuery}”…</div>
            )}

            {entries && !entry && (
              <div className="ip-attach-list">
                {entries.length === 0 && (
                  <div className="ip-attach-empty">No Jimaku entries found.</div>
                )}
                {entries.map((e) => (
                  <button key={e.id} className="ip-attach-item" onClick={() => pickEntry(e)}>
                    <span lang="ja">{e.japanese_name ?? e.name}</span>
                    {e.english_name && <span className="ip-attach-sub">{e.english_name}</span>}
                  </button>
                ))}
              </div>
            )}

            {entry && files && (
              <>
                <button className="ip-back" onClick={() => { setEntry(null); setFiles(null); }}>
                  ← back to Jimaku results
                </button>
                <div className="ip-section-label">Japanese track (required)</div>
                {files.length > 0 && (
                  <div className="ip-paste-hint">
                    Showing individual .srt/.ass tracks for ep {selectedEp} — not bulk .zip archives.
                  </div>
                )}
                <div className="ip-attach-list">
                  {files.length === 0 && (
                    <div className="ip-attach-empty">
                      No per-episode subtitle files matched — try another Jimaku entry or search title.
                    </div>
                  )}
                  {files.map((f) => (
                    <button
                      key={f.url}
                      className={"ip-attach-item" + (jaFile?.url === f.url ? " sel" : "")}
                      onClick={() => setJaFile(f)}
                    >
                      {f.name}
                      <span className="ip-attach-sub">{formatSize(f.size)}</span>
                    </button>
                  ))}
                </div>
                <div className="ip-section-label">English track (optional)</div>
                <div className="ip-attach-list">
                  <button
                    className={"ip-attach-item" + (enFile === null ? " sel" : "")}
                    onClick={() => setEnFile(null)}
                  >
                    none
                  </button>
                  {files.map((f) => (
                    <button
                      key={f.url}
                      className={"ip-attach-item" + (enFile?.url === f.url ? " sel" : "")}
                      onClick={() => setEnFile(f)}
                    >
                      {f.name}
                      <span className="ip-attach-sub">{formatSize(f.size)}</span>
                    </button>
                  ))}
                </div>
                <div className="ip-modal-actions">
                  <button
                    className="btn-primary"
                    disabled={busy || !jaFile}
                    onClick={importEpisode}
                  >
                    Enrich &amp; watch
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function EpisodePickerLoading({ title, busy }: { title: string; busy: boolean }) {
  return (
    <div className="ip-anime-loading" role="status" aria-live="polite">
      <div className="ip-anime-loading-spinner" aria-hidden />
      <p className="ip-anime-loading-title">
        {busy ? "Finding episodes" : "Couldn\u2019t load episodes"}
      </p>
      <p className="ip-anime-loading-hint">
        {busy ? (
          <>
            Looking up <span lang="ja">{title}</span> in the stream catalog.
            This usually takes a few seconds.
          </>
        ) : (
          <>The episode list didn&apos;t load. Try again in a moment.</>
        )}
      </p>
      {busy && (
        <div className="ip-anime-loading-skeleton" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="ip-anime-loading-row"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
