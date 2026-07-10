import { useState } from "react";
import {
  clearJimakuApiKey,
  hasJimakuApiKey,
  loadJimakuApiKey,
  saveJimakuApiKey,
} from "../lib/jimaku-key";

interface Props {
  /** Tighter layout for modals vs the full settings page. */
  compact?: boolean;
  /** When true, server already has JIMAKU_API_KEY — soften BYOK copy. */
  serverHasJimaku?: boolean;
  onSaved?: () => void;
}

/**
 * Paste a Jimaku API key from jimaku.cc → account page. Stored locally in the
 * browser; sent only when searching or importing fan subtitles.
 */
export function JimakuKeySettings({ compact, serverHasJimaku, onSaved }: Props) {
  const [key, setKey] = useState(() => loadJimakuApiKey() ?? "");
  const [stored, setStored] = useState(hasJimakuApiKey());
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (!saveJimakuApiKey(trimmed)) {
      setSaveError("Could not save key — check browser storage permissions.");
      return;
    }
    setSaveError(null);
    setStored(true);
    onSaved?.();
  };

  const remove = () => {
    if (!clearJimakuApiKey()) {
      setSaveError("Could not remove key — check browser storage permissions.");
      return;
    }
    setSaveError(null);
    setKey("");
    setStored(false);
  };

  return (
    <section className={"ip-jimaku-key" + (compact ? " compact" : "")}>
      <div className="ip-section-label">Jimaku API key</div>
      <p className="ip-jimaku-key-note">
        {serverHasJimaku ? (
          <>
            Optional: paste your own Jimaku key to override the server default. Keys from{" "}
            <a href="https://jimaku.cc/account" target="_blank" rel="noreferrer">
              jimaku.cc/account
            </a>{" "}
            stay in your browser only.
          </>
        ) : (
          <>
            Jimaku fan subtitles need your own free API key from{" "}
            <a href="https://jimaku.cc/account" target="_blank" rel="noreferrer">
              jimaku.cc/account
            </a>
            . It stays in your browser — we never store it on our servers.
          </>
        )}
      </p>
      <div className="ip-attach-search">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste your Jimaku API key"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setSaveError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button type="button" className="btn-primary" disabled={!key.trim()} onClick={save}>
          Save
        </button>
      </div>
      {saveError && <p className="ip-jimaku-key-note ip-error">{saveError}</p>}
      {stored && (
        <div className="ip-jimaku-key-status">
          <span className="chip chip-amber">Key saved</span>
          <button type="button" className="ip-attach-switch" onClick={remove}>
            Remove key
          </button>
        </div>
      )}
    </section>
  );
}
