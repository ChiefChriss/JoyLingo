import { lineText, type KnowledgeMap } from "@joylingo/player-core";
import type { VocabularyEntry } from "@joylingo/shared";
import {
  pronunciationVoiceEnabled,
  speakJapanese,
} from "../lib/teacher-voice";
import type { Selection } from "./ImmersionPlayer";

interface Props {
  selection: Selection;
  knowledge: KnowledgeMap;
  encounter?: VocabularyEntry | null;
  episodeId: string;
  onAdd: () => void;
  onClose: () => void;
  onJumpToFirst?: () => void;
}

export function DictionaryCard({
  selection,
  knowledge,
  encounter,
  episodeId,
  onAdd,
  onClose,
  onJumpToFirst,
}: Props) {
  const { tok, line } = selection;
  const entry = knowledge[tok.dict];
  return (
    <section className="ip-dict">
      <div className="ip-dict-head">
        <span className="ip-dict-word" lang="ja">{tok.dict}</span>
        {tok.r && <span className="ip-dict-reading" lang="ja">【{tok.r}】</span>}
        <span className="ip-dict-pos">{tok.pos}</span>
        <button className="ip-dict-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="ip-dict-gloss">{tok.gloss ?? "— no dictionary entry —"}</div>
      <div className="ip-dict-context" lang="ja">「{lineText(line)}」</div>
      {encounter && encounter.tapCount > 0 && (
        <div className="ip-dict-encounter">
          Seen {encounter.tapCount} time{encounter.tapCount === 1 ? "" : "s"}
          {encounter.firstClip.episodeId !== episodeId || encounter.firstClip.lineId !== line.id ? (
            <>
              {" · "}
              <button type="button" className="ip-link" onClick={onJumpToFirst}>
                first seen in {encounter.firstClip.episodeId}
              </button>
            </>
          ) : null}
        </div>
      )}
      <div className="ip-dict-actions">
        {pronunciationVoiceEnabled() && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              speakJapanese(tok.s, {
                reading: tok.r ?? undefined,
              })
            }
            aria-label={`Hear ${tok.r ?? tok.s} pronounced slowly`}
          >
            Hear word
          </button>
        )}
        {entry ? (
          <span className="chip chip-amber">in your deck · {entry.status}</span>
        ) : (
          <button className="btn-primary" onClick={onAdd}>+ Add to deck</button>
        )}
      </div>
    </section>
  );
}
