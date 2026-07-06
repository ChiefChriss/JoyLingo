import { memo } from "react";
import type { Line, WordToken } from "@joylingo/shared";
import { isWord } from "@joylingo/shared";
import type { KnowledgeStatus } from "@joylingo/player-core";
import type { Selection } from "./ImmersionPlayer";

type TokenStatus = KnowledgeStatus | "encountered" | null;

interface Props {
  line: Line;
  furigana: boolean;
  selected: Selection | null;
  statusOf: (tok: WordToken) => TokenStatus;
  onTap: (tok: WordToken) => void;
}

export const SubtitleLine = memo(function SubtitleLine({
  line,
  furigana,
  statusOf,
  onTap,
  selected,
}: Props) {
  return (
    <div className="ip-subline" lang="ja">
      {line.tokens.map((tok, i) => {
        if (!isWord(tok)) return <span key={i} className="ip-tok-punct">{tok.s}</span>;
        const st = statusOf(tok);
        const isSel = selected?.tok === tok;
        return (
          <button
            key={i}
            className={
              "ip-tok" +
              (st === "learning" ? " learning" : st === "known" ? " known" : st === "encountered" ? " encountered" : "") +
              (isSel ? " sel" : "")
            }
            onClick={() => onTap(tok)}
            aria-label={tok.dict}
          >
            {furigana && tok.r ? (
              <ruby>{tok.s}<rt>{tok.r}</rt></ruby>
            ) : (
              tok.s
            )}
          </button>
        );
      })}
    </div>
  );
});
