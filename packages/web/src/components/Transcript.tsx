import { memo } from "react";
import type { Line } from "@joylingo/shared";
import { lineText } from "@joylingo/player-core";
import { formatTime } from "../lib/episodes";

interface Props {
  lines: Line[];
  activeLineId: string | null;
  /** Subtitle offset in seconds, so displayed times match the video timeline. */
  offset: number;
  onJump: (line: Line) => void;
}

const TranscriptLine = memo(function TranscriptLine({
  line,
  active,
  offset,
  onJump,
}: {
  line: Line;
  active: boolean;
  offset: number;
  onJump: (line: Line) => void;
}) {
  return (
    <button
      className={"ip-tr-line" + (active ? " active" : "")}
      onClick={() => onJump(line)}
    >
      <span className="ip-tr-time">{formatTime(Math.max(0, line.start + offset))}</span>
      <span className="ip-tr-text" lang="ja">{lineText(line)}</span>
    </button>
  );
});

export const Transcript = memo(function Transcript({
  lines,
  activeLineId,
  offset,
  onJump,
}: Props) {
  return (
    <section className="ip-transcript">
      <div className="ip-section-label">Transcript · tap a line to jump</div>
      {lines.map((l) => (
        <TranscriptLine
          key={l.id}
          line={l}
          active={activeLineId === l.id}
          offset={offset}
          onJump={onJump}
        />
      ))}
    </section>
  );
});
