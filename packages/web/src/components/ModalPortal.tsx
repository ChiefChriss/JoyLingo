import { createPortal } from "react-dom";

/** Render modals at document.body so fixed overlays aren't clipped by page layout. */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
