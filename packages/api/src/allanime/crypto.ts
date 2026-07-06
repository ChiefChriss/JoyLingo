import { createHash, createDecipheriv } from "crypto";

const AES_KEY = createHash("sha256").update("Xot36i3lK3:v1").digest();

export function decryptToBeParsed(b64: string): string | null {
  const raw = Buffer.from(b64, "base64");
  if (raw.length <= 13 + 16) return null;

  const iv = raw.subarray(1, 13);
  const ctLen = raw.length - 13 - 16;
  if (ctLen <= 0) return null;
  const ciphertext = raw.subarray(13, 13 + ctLen);

  const counterBlock = Buffer.concat([iv, Buffer.from([0x00, 0x00, 0x00, 0x02])]);

  try {
    const decipher = createDecipheriv("aes-256-ctr", AES_KEY, counterBlock);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

export function decodeProviderId(raw: string): string | null {
  let hex = raw;
  if (hex.startsWith("--")) hex = hex.slice(2);
  if (hex.length % 2 !== 0 || hex.length === 0) return raw;

  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes.push(byte ^ 0x38);
  }

  const decoded = Buffer.from(bytes).toString("utf8");
  return decoded.replace("/clock", "/clock.json");
}
