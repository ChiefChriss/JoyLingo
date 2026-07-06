import type { FusionCard, FusionCardStatus } from "@joylingo/shared";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** FSRS-lite scheduling for fusion clip cards (mirrors kanji grading). */
export function gradeFusionCard(
  card: FusionCard,
  good: boolean,
  now = new Date(),
): FusionCard {
  const reviewedAt = now.toISOString();
  if (!good) {
    return {
      ...card,
      status: "learning" as FusionCardStatus,
      intervalDays: 0,
      dueAt: reviewedAt,
      lastReviewedAt: reviewedAt,
    };
  }
  const intervalDays =
    card.intervalDays === 0 && card.lastReviewedAt == null
      ? 1
      : Math.min((card.intervalDays || 1) * 2, 60);
  return {
    ...card,
    status: "known" as FusionCardStatus,
    intervalDays,
    dueAt: addDays(reviewedAt, intervalDays),
    lastReviewedAt: reviewedAt,
  };
}

export function dueFusionCards(cards: FusionCard[]): FusionCard[] {
  const now = Date.now();
  return cards.filter(
    (c) => c.status === "learning" && new Date(c.dueAt).getTime() <= now,
  );
}

/** Pick 3 distractor glosses from the same lesson word list. */
export function fusionDistractors(
  correctGloss: string,
  lessonGlosses: string[],
  count = 3,
): string[] {
  const pool = lessonGlosses.filter(
    (g) => g.toLowerCase() !== correctGloss.toLowerCase(),
  );
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function shuffleChoices(choices: string[]): string[] {
  return [...choices].sort(() => Math.random() - 0.5);
}
