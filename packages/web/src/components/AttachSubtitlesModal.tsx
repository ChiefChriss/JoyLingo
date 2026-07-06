import { useEffect, useState } from "react";
import {
  fetchYoutubeCaptions,
  fetchYoutubeMetadata,
  getImportJob,
  listJimakuFiles,
  searchJimaku,
  startImport,
  startYoutubeImport,
  type CaptionTracks,
  type JimakuEntry,
  type JimakuFile,
  type YoutubeMetadata,
} from "../lib/api";

interface Props {
  videoId: string;
  onClose: () => void;
  /** Called with the new episode id once enrichment finishes. */
  onImported: (episodeId: string) => void;
}

const POLL_MS = 1500;

type Step = "youtube" | "jimaku";

/**
 * Paste-URL miss → attach subtitles. YouTube-first: probe the video's own
 * caption tracks (server-side yt-dlp) and offer one-click enrich; Jimaku
 * search is the fallback / explicit opt-in.
 */
export function AttachSubtitlesModal({ videoId, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("youtube");
  const [meta, setMeta] = useState<YoutubeMetadata | null>(null);

  // youtube step
  const [cc, setCc] = useState<CaptionTracks | null>(null);
  const [ccLoading, setCcLoading] = useState(true);
  const [ccError, setCcError] = useState<string | null>(null);

  // jimaku step
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<JimakuEntry[] | null>(null);
  const [entry, setEntry] = useState<JimakuEntry | null>(null);
  const [files, setFiles] = useState<JimakuFile[] | null>(null);
  const [jaFile, setJaFile] = useState<JimakuFile | null>(null);
  const [enFile, setEnFile] = useState<JimakuFile | null>(null);

  // shared
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchYoutubeMetadata(videoId).then(
      (m) => {
        setMeta(m);
        setQuery((q) => q || m.title);
      },
      () => setMeta({ videoId, title: "", channel: "" }),
    );
    fetchYoutubeCaptions(videoId)
      .then(setCc, (e: Error) => setCcError(e.message))
      .finally(() => setCcLoading(false));
  }, [videoId]);

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
        // transient poll failure — keep trying
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [jobId, onImported]);

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

  const importFromYoutube = () =>
    run(async () => {
      const ja = cc?.recommended.ja;
      if (!ja) return;
      const en = cc.recommended.en;
      setJobStatus("pending");
      setJobId(
        await startYoutubeImport({
          youtubeVideoId: videoId,
          jaLang: ja.lang,
          jaAuto: ja.auto,
          enLang: en?.lang,
          enAuto: en?.auto,
          title: cc.title || meta?.title || undefined,
        }),
      );
    });

  const search = () =>
    run(async () => {
      setEntry(null);
      setFiles(null);
      setEntries(await searchJimaku(query));
    });

  const pickEntry = (e: JimakuEntry) =>
    run(async () => {
      setEntry(e);
      setJaFile(null);
      setEnFile(null);
      setFiles(await listJimakuFiles(e.id));
    });

  const importFromJimaku = () =>
    run(async () => {
      if (!entry || !jaFile) return;
      setJobStatus("pending");
      setJobId(
        await startImport({
          youtubeVideoId: videoId,
          title: entry.japanese_name ?? entry.name,
          titleEn: entry.english_name ?? meta?.title ?? undefined,
          jimakuEntryId: entry.id,
          jaFileUrl: jaFile.url,
          jaFileName: jaFile.name,
          enFileUrl: enFile?.url,
          enFileName: enFile?.name,
        }),
      );
    });

  if (jobId) {
    return (
      <div className="ip-modal-backdrop">
        <div className="ip-modal">
          <div className="ip-modal-word">⏳</div>
          <div className="ip-modal-gloss">
            {jobStatus === "running" ? "Tokenizing… attaching glosses…" : "Fetching subtitles…"}
          </div>
          <div className="ip-modal-note">Usually takes a few seconds.</div>
        </div>
      </div>
    );
  }

  const recJa = cc?.recommended.ja ?? null;
  const recEn = cc?.recommended.en ?? null;

  return (
    <div className="ip-modal-backdrop" onClick={onClose}>
      <div className="ip-modal ip-attach" onClick={(e) => e.stopPropagation()}>
        <div className="ip-attach-head">
          <div>
            <div className="ip-section-label">Attach subtitles</div>
            <div className="ip-attach-video">
              {meta?.title || videoId}
              {meta?.channel && <span className="ip-attach-channel"> · {meta.channel}</span>}
            </div>
          </div>
          <button className="ip-dict-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="ip-attach-error">{error}</div>}

        {step === "youtube" && (
          <>
            {ccLoading && <div className="ip-attach-empty">Checking YouTube captions…</div>}

            {!ccLoading && recJa && (
              <>
                <div className="ip-section-label">Found on YouTube</div>
                <div className="ip-attach-list">
                  <div className="ip-attach-track">
                    <span lang="ja">日本語</span> — {recJa.name}
                    <span className={"chip ip-cc-kind" + (recJa.auto ? "" : " chip-amber")}>
                      {recJa.auto ? "auto-generated" : "creator captions"}
                    </span>
                  </div>
                  {recEn && (
                    <div className="ip-attach-track">
                      English — {recEn.name}
                      <span className={"chip ip-cc-kind" + (recEn.auto ? "" : " chip-amber")}>
                        {recEn.auto ? "auto-generated" : "creator captions"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="ip-modal-actions">
                  <button className="btn-primary" disabled={busy} onClick={importFromYoutube}>
                    Enrich &amp; watch
                  </button>
                </div>
              </>
            )}

            {!ccLoading && !recJa && (
              <div className="ip-attach-empty">
                {ccError ?? "This video has no Japanese captions on YouTube."}
              </div>
            )}

            {!ccLoading && (
              <button className="ip-attach-switch" onClick={() => setStep("jimaku")}>
                {recJa ? "Search Jimaku instead →" : "Search Jimaku for subtitles →"}
              </button>
            )}
          </>
        )}

        {step === "jimaku" && (
          <>
            <button className="ip-back" onClick={() => setStep("youtube")}>
              ← YouTube captions
            </button>
            <div className="ip-attach-search">
              <input
                value={query}
                placeholder="Search Jimaku (anime title)…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && query.trim() && search()}
              />
              <button className="btn-primary" disabled={busy || !query.trim()} onClick={search}>
                Search
              </button>
            </div>

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
                  ← back to results
                </button>
                <div className="ip-section-label">Japanese track (required)</div>
                <div className="ip-attach-list">
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
                  <button className="btn-primary" disabled={busy || !jaFile} onClick={importFromJimaku}>
                    Enrich &amp; watch
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
