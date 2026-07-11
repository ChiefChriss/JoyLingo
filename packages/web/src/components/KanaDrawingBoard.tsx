/** Pointer-based kana drawing canvas with undo / clear. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Point, Stroke } from "../lib/kana-strokes";

interface Props {
  /** Bump to wipe the board (e.g. next character). */
  resetKey?: string | number;
  /** Ghost character under the ink (guide). */
  guideChar?: string | null;
  showGuide?: boolean;
  disabled?: boolean;
  onStrokesChange?: (strokes: Stroke[]) => void;
  className?: string;
}

const LOGICAL = 320;

export function KanaDrawingBoard({
  resetKey,
  guideChar,
  showGuide = true,
  disabled,
  onStrokesChange,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const css = canvas.clientWidth || LOGICAL;
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = css;

    ctx.clearRect(0, 0, size, size);

    // Board background
    ctx.fillStyle = "#121722";
    ctx.fillRect(0, 0, size, size);

    // Light grid
    ctx.strokeStyle = "rgba(42, 50, 69, 0.65)";
    ctx.lineWidth = 1;
    const step = size / 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(step * i, 0);
      ctx.lineTo(step * i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, step * i);
      ctx.lineTo(size, step * i);
      ctx.stroke();
    }

    // Center guide crosshair (faint)
    ctx.strokeStyle = "rgba(227, 165, 63, 0.12)";
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    // Ghost character
    if (showGuide && guideChar) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#e3a53f";
      ctx.font = `700 ${Math.floor(size * 0.62)}px "Noto Serif JP", "Hiragino Mincho ProN", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(guideChar, size / 2, size / 2 + size * 0.02);
      ctx.restore();
    }

    // Ink
    ctx.strokeStyle = "#ece6d9";
    ctx.lineWidth = Math.max(3.5, size * 0.018);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x * size, stroke[0]!.y * size);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i]!.x * size, stroke[i]!.y * size);
      }
      ctx.stroke();
    }
  }, [guideChar, showGuide]);

  useEffect(() => {
    strokesRef.current = [];
    setStrokeCount(0);
    onStrokesChange?.([]);
    paint();
    // Only wipe board when the prompt changes — not when guide toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paint]);

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const emit = () => {
    setStrokeCount(strokesRef.current.length);
    onStrokesChange?.(strokesRef.current.map((s) => s.map((p) => ({ ...p }))));
    paint();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const p = toNorm(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, [p]];
    emit();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const p = toNorm(e);
    if (!p) return;
    const strokes = strokesRef.current;
    const last = strokes[strokes.length - 1];
    if (!last) return;
    const prev = last[last.length - 1];
    if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 0.004) return;
    last.push(p);
    paint();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Drop tiny accidental taps
    const strokes = strokesRef.current;
    const last = strokes[strokes.length - 1];
    if (last && last.length < 2) {
      strokesRef.current = strokes.slice(0, -1);
    }
    emit();
  };

  const undo = () => {
    if (disabled) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    emit();
  };

  const clear = () => {
    if (disabled) return;
    strokesRef.current = [];
    emit();
  };

  return (
    <div className={"kana-draw" + (className ? ` ${className}` : "")}>
      <canvas
        ref={canvasRef}
        className="kana-draw-canvas"
        width={LOGICAL}
        height={LOGICAL}
        aria-label="Kana drawing board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="kana-draw-toolbar">
        <span className="kana-draw-meta">
          {strokeCount} stroke{strokeCount === 1 ? "" : "s"}
        </span>
        <div className="kana-draw-actions">
          <button type="button" className="tool" disabled={disabled || strokeCount === 0} onClick={undo}>
            Undo
          </button>
          <button type="button" className="tool" disabled={disabled || strokeCount === 0} onClick={clear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
