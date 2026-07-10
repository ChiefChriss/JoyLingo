import { afterEach, describe, expect, it, vi } from "vitest";
import { METADATA_TTL_MS, TtlCache } from "../src/ttl-cache.js";

describe("TtlCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached values before ttl expires", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(999);
    expect(cache.get("k")).toBe("v");
  });

  it("drops expired entries", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000);
    cache.set("k", "v");
    vi.advanceTimersByTime(1000);
    expect(cache.get("k")).toBeUndefined();
  });

  it("getOrSet loads once then serves cache", async () => {
    const cache = new TtlCache<number>(METADATA_TTL_MS);
    let loads = 0;
    const loader = async () => {
      loads++;
      return 42;
    };
    expect(await cache.getOrSet("n", loader)).toBe(42);
    expect(await cache.getOrSet("n", loader)).toBe(42);
    expect(loads).toBe(1);
  });
});
