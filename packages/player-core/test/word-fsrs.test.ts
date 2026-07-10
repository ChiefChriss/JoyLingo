import { describe, expect, it, vi } from "vitest";
import { mineEntry } from "../src/deck.js";
import { gradeWordCard, isWordDue, ensureWordFsrs } from "../src/word-fsrs.js";
import type { Line, WordToken } from "@joylingo/shared";

const TOK: WordToken = {
  s: "電車",
  r: "でんしゃ",
  dict: "電車",
  gloss: "train",
  pos: "n",
};
const LINE: Line = {
  id: "L1",
  start: 0,
  end: 2,
  en: "train",
  tokens: [TOK],
};

describe("word FSRS", () => {
  it("mines with initial due state", () => {
    const entry = mineEntry(TOK, LINE);
    expect(entry.status).toBe("learning");
    expect(entry.fsrs).toBeTruthy();
    expect(entry.dueAt).toBeTruthy();
    expect(isWordDue(entry)).toBe(true);
  });

  it("Again keeps card learning and due soon", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-08T12:00:00.000Z");
    vi.setSystemTime(now);
    const entry = mineEntry(TOK, LINE);
    const graded = gradeWordCard(entry, false, now);
    expect(graded.status).toBe("learning");
    expect(new Date(graded.dueAt).getTime()).toBeGreaterThanOrEqual(now.getTime());
    vi.useRealTimers();
  });

  it("Good schedules a later review instead of instant graduation", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    const entry = mineEntry(TOK, LINE);
    const graded = gradeWordCard(entry, true, now);
    expect(graded.status).toBe("learning");
    expect(new Date(graded.dueAt).getTime()).toBeGreaterThan(now.getTime());
    expect(isWordDue(graded, now.getTime() + 60_000)).toBe(false);
  });

  it("backfills legacy deck entries without fsrs fields", () => {
    const legacy = {
      status: "learning" as const,
      reading: "でんしゃ",
      gloss: "train",
      surface: "電車",
      context: "電車",
      contextEn: null,
    };
    const ready = ensureWordFsrs(legacy);
    expect(ready.fsrs).toBeTruthy();
    expect(ready.dueAt).toBeTruthy();
  });
});
