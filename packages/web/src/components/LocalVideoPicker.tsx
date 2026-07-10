import { useRef } from "react";

/**
 * Session-scoped local video file picker. Blob URLs stay in React state only —
 * never persisted to catalog/DB and never uploaded.
 */
export function LocalVideoPicker({
  fileName,
  onPick,
  onClear,
}: {
  fileName: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="ip-local-video-bar">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
        className="ip-local-video-input"
        aria-label="Open local video file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      {fileName ? (
        <>
          <span className="chip chip-amber ip-local-video-name" title={fileName}>
            {fileName}
          </span>
          <button
            type="button"
            className="chip chip-link"
            onClick={() => inputRef.current?.click()}
          >
            Change local video
          </button>
          <button type="button" className="chip chip-link" onClick={onClear}>
            Clear local video
          </button>
        </>
      ) : (
        <button
          type="button"
          className="chip chip-link"
          onClick={() => inputRef.current?.click()}
        >
          Open local video
        </button>
      )}
    </div>
  );
}
