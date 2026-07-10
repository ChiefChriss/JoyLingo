/** User-owned Jimaku API key — stored in the browser only, never synced to our DB. */
const KEY = "joylingo:jimaku-api-key";

export function loadJimakuApiKey(): string | null {
  try {
    const v = localStorage.getItem(KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function saveJimakuApiKey(key: string): boolean {
  try {
    localStorage.setItem(KEY, key.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearJimakuApiKey(): boolean {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasJimakuApiKey(): boolean {
  return Boolean(loadJimakuApiKey());
}

/** Header value for Jimaku-proxied API routes (empty when unset). */
export function jimakuApiKeyHeader(): Record<string, string> {
  const key = loadJimakuApiKey();
  return key ? { "x-jimaku-api-key": key } : {};
}
