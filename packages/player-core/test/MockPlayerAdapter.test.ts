import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockPlayerAdapter } from "../src/adapters/MockPlayerAdapter.js";

describe("MockPlayerAdapter", () => {
  beforeEach(() => {
    // The adapter measures elapsed time with performance.now(), which vitest
    // does not fake by default — include it so advanceTimersByTime moves it.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clamps seek to [0, duration]", () => {
    const a = new MockPlayerAdapter(30);
    a.seek(-5);
    expect(a.getCurrentTime()).toBe(0);
    a.seek(45);
    expect(a.getCurrentTime()).toBe(30);
    a.seek(12);
    expect(a.getCurrentTime()).toBe(12);
    a.destroy();
  });

  it("advances time while playing", () => {
    const a = new MockPlayerAdapter(30);
    a.play();
    expect(a.isPlaying()).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(a.getCurrentTime()).toBeCloseTo(2, 1);
    a.pause();
    vi.advanceTimersByTime(1000);
    expect(a.getCurrentTime()).toBeCloseTo(2, 1);
    a.destroy();
  });

  it("auto-pauses and clamps at the end", () => {
    const a = new MockPlayerAdapter(1);
    const states: boolean[] = [];
    a.onStateChange((p) => states.push(p));
    a.play();
    vi.advanceTimersByTime(2000);
    expect(a.getCurrentTime()).toBe(1);
    expect(a.isPlaying()).toBe(false);
    expect(states).toEqual([true, false]);
    a.destroy();
  });

  it("restarts from zero when played again after ending", () => {
    const a = new MockPlayerAdapter(1);
    a.play();
    vi.advanceTimersByTime(2000);
    expect(a.getCurrentTime()).toBe(1);
    a.play();
    expect(a.getCurrentTime()).toBe(0);
    expect(a.isPlaying()).toBe(true);
    a.destroy();
  });

  it("notifies time subscribers and honors unsubscribe", () => {
    const a = new MockPlayerAdapter(30);
    const ticks: number[] = [];
    const off = a.onTimeUpdate((t) => ticks.push(t));
    a.seek(5);
    expect(ticks).toEqual([5]);
    off();
    a.seek(10);
    expect(ticks).toEqual([5]);
    a.destroy();
  });
});
