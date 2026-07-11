import { describe, expect, it } from "vitest";
import { allowTeacherRequest } from "../src/teacher/rate-limit.js";

describe("teacher rate limit", () => {
  it("allows a burst then blocks within the window", () => {
    const id = `test-${Math.random()}`;
    for (let i = 0; i < 30; i++) {
      expect(allowTeacherRequest(id, 30, 60_000)).toBe(true);
    }
    expect(allowTeacherRequest(id, 30, 60_000)).toBe(false);
  });
});
