/**
 * Postgres TEXT/JSONB is UTF-8 and rejects NUL (0x00). Fan subs from Jimaku
 * are often UTF-16 LE — reading them as UTF-8 leaves embedded nulls.
 */

/** Strip NUL bytes — safe for any already-decoded string. */
export function stripNullBytes(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) !== 0) out += text[i];
  }
  return out;
}

/** Decode subtitle file bytes (UTF-8/UTF-16 + BOM) and remove NULs. */
export function decodeSubtitleBytes(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return stripNullBytes(buf.subarray(2).toString("utf16le"));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const body = Buffer.from(buf.subarray(2));
    body.swap16();
    return stripNullBytes(body.toString("utf16le"));
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return stripNullBytes(buf.subarray(3).toString("utf8"));
  }
  // UTF-16 LE without BOM — common for .ass from fansub groups
  if (looksUtf16Le(buf)) {
    return stripNullBytes(buf.toString("utf16le"));
  }
  return stripNullBytes(buf.toString("utf8"));
}

function looksUtf16Le(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  let nulPairs = 0;
  const sample = Math.min(buf.length, 200);
  for (let i = 1; i < sample; i += 2) {
    if (buf[i] === 0) nulPairs++;
  }
  return nulPairs > sample / 8;
}

/** Recursively strip NULs from string fields before JSONB insert. */
export function sanitizeStringsDeep<T>(value: T): T {
  if (typeof value === "string") return stripNullBytes(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeStringsDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeStringsDeep(v);
    }
    return out as T;
  }
  return value;
}
