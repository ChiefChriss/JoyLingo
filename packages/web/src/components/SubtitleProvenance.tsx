import type { Episode } from "@joylingo/shared";
import type { EpisodeSource } from "@joylingo/player-core";

const SOURCE_LABEL: Record<NonNullable<EpisodeSource["subtitleSource"]>, string> = {
  youtube: "YouTube captions",
  jimaku: "Jimaku fan subtitles",
  upload: "Uploaded subtitles",
};

function formatEnrichedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

interface Props {
  source: EpisodeSource;
  episode: Episode;
}

export function SubtitleProvenance({ source, episode }: Props) {
  const kind = source.subtitleSource;
  const enrichedAt = episode.meta?.generatedAt;
  const format = episode.meta?.source?.toUpperCase();

  if (!kind && !enrichedAt) return null;

  return (
    <div className="ip-provenance">
      {kind && <span className="chip chip-amber">{SOURCE_LABEL[kind]}</span>}
      {format && <span className="chip">{format}</span>}
      {source.jimakuFileName && (
        <span className="ip-provenance-file" title={source.jimakuFileName}>
          {source.jimakuFileName}
        </span>
      )}
      {enrichedAt && (
        <span className="ip-provenance-date">Enriched {formatEnrichedAt(enrichedAt)}</span>
      )}
    </div>
  );
}
