/** Simple sliding-window rate limit per device id. */
const hits = new Map<string, number[]>();

export function allowTeacherRequest(
  deviceId: string,
  limit = 30,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const prev = hits.get(deviceId) ?? [];
  const recent = prev.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(deviceId, recent);
    return false;
  }
  recent.push(now);
  hits.set(deviceId, recent);
  return true;
}
