import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { signals, sma } from "@/lib/backtest/signal";

/** Synthetic bars from a list of adjusted closes; the other fields do not matter here. */
function synthetic(adj: number[]): Bar[] {
  return adj.map((a, i) => ({
    date: `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
    open: a,
    high: a,
    low: a,
    close: a,
    adjusted_close: a,
    volume: 0,
  }));
}

// 120 bars: long enough for a 50-day average to exist well before bar 80.
const wave = Array.from({ length: 120 }, (_, i) => 100 + 10 * Math.sin(i / 9) + i * 0.1);

describe("the leak test", () => {
  it("a signal at bar 80 does not move when bars 81 to 120 change", () => {
    const params = { fast: 20, slow: 50 };
    const before = signals(synthetic(wave), params);
    const future = wave.map((v, i) => (i > 80 ? 1000 - v * 3 : v));
    const after = signals(synthetic(future), params);
    expect(before[80]).not.toBeNull();
    expect(after.slice(0, 81)).toEqual(before.slice(0, 81));
  });
});

describe("sma", () => {
  it("averages a window that ends at the bar", () => {
    expect(sma([1, 2, 3, 4, 5], 3, 4)).toBe(4);
    expect(sma([1, 2, 3, 4, 5], 3, 2)).toBe(2);
  });

  it("refuses a short window instead of averaging whatever slice() returned", () => {
    // At bar 1 a three-bar window does not exist yet; slice(-1, 2) would quietly be empty.
    expect(() => sma([1, 2, 3, 4, 5], 3, 1)).toThrow("short window at bar 1");
  });
});

describe("signals", () => {
  it("are null until the slow average exists", () => {
    const s = signals(synthetic(wave), { fast: 20, slow: 50 });
    expect(s.slice(0, 49).every((x) => x === null)).toBe(true);
    expect(s[49]).not.toBeNull();
  });
});
