/** Production API origin (Railway). Empty in dev — Vite proxies `/api` locally. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return API_BASE ? `${API_BASE}/${path}` : path;
  return API_BASE ? `${API_BASE}${path}` : path;
}
