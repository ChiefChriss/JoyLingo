export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.5 + 0.4 * ratio;
  }
  const ta = tokens(a);
  const tb = tokens(b);
  const union = new Set([...ta, ...tb]).size;
  if (union === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  return intersection / union;
}

export function partNumber(s: string): number | null {
  const n = normalize(s);
  for (const p of [/part\s+(\d+)/, /cour\s+(\d+)/]) {
    const m = n.match(p);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

export function seasonNumber(s: string): number | null {
  const n = normalize(s);
  let m = n.match(/season\s+(\d+)/);
  if (m?.[1]) return parseInt(m[1], 10);
  m = n.match(/(\d+)\s+part\s+\d+/);
  if (m?.[1]) return parseInt(m[1], 10);
  m = n.match(/(\d+)(?:st|nd|rd|th)\s+season/);
  if (m?.[1]) return parseInt(m[1], 10);
  const roman: Record<string, number> = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
  const parts = n.split(" ");
  const last = parts[parts.length - 1];
  if (last && roman[last]) return roman[last];
  return null;
}

function mentionsFinalSeason(s: string): boolean {
  return normalize(s).includes("final season");
}

export function titleScore(resultName: string, candidates: string[]): number {
  return Math.max(...candidates.map((c) => similarity(resultName, c)), 0);
}

export function scoreMatch(
  resultName: string,
  resultEpisodes: number,
  candidates: string[],
  targetEpisodes: number | null,
): number {
  let s = titleScore(resultName, candidates);

  const targetSeason = Math.max(...candidates.map((c) => seasonNumber(c) ?? 0), 1) || 1;
  const resultSeason = seasonNumber(resultName) ?? 1;
  s += targetSeason === resultSeason ? 0.15 : -0.25;

  const targetFinal = candidates.some(mentionsFinalSeason);
  const resultFinal = mentionsFinalSeason(resultName);
  if (targetFinal || resultFinal) {
    s += targetFinal === resultFinal ? 0.15 : -0.25;
  }

  const targetPart = Math.max(
    ...candidates.map((c) => partNumber(c) ?? 0).filter((n) => n > 0),
    0,
  );
  const resultPart = partNumber(resultName);
  if (targetPart > 0) {
    if (resultPart === targetPart) s += 0.15;
    else if (resultPart != null) s -= 0.25;
    else s -= 0.1;
  } else if (resultPart != null && resultPart > 1) {
    s -= 0.15;
  }

  if (targetEpisodes && targetEpisodes > 0 && resultEpisodes > 0) {
    const diff = Math.abs(resultEpisodes - targetEpisodes);
    if (diff === 0) s += 0.1;
    else if (diff <= 2) s += 0.05;
  }

  return s;
}
