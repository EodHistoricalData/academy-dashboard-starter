import { describe, expect, it } from "vitest";
import { buyAndHold } from "@/lib/backtest/baseline";
import type { Bar } from "@/lib/backtest/candles";
import { maxDrawdown, totalReturn } from "@/lib/backtest/metrics";

const bars = (adj: number[]): Bar[] =>
  adj.map((a, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    open: a,
    high: a,
    low: a,
    close: a,
    adjusted_close: a,
    volume: 0,
  }));

describe("buy and hold", () => {
  it("compounds adjusted returns from 1 and makes one trade", () => {
    const run = buyAndHold(bars([100, 110, 99]), 0);
    // 1, then ×1.1, then ×0.9. Compared with a tolerance: 1.1 × 0.9 is not exactly 0.99
    // in binary floating point.
    [1, 1.1, 0.99].forEach((v, i) => expect(run.gross[i]).toBeCloseTo(v, 12));
    expect(run.net).toEqual(run.gross);
    expect(run.trades).toBe(1);
  });

  it("draws the cost line below the gross one as soon as a cost is set", () => {
    const run = buyAndHold(bars([100, 110, 99]), 10);
    // Bought at 10 bps and sold at 10 bps: 0.99 * 0.999 * 0.999.
    expect(run.net.at(-1)).toBeCloseTo(0.99 * 0.999 * 0.999, 12);
    expect(run.net[0]).toBeCloseTo(0.999, 12);
  });

  it("draws nothing for an empty or one-bar series", () => {
    expect(buyAndHold([], 0).gross).toEqual([]);
    expect(buyAndHold(bars([100]), 0).gross).toEqual([1]);
  });
});

describe("the three numbers", () => {
  it("total return is the last point over the first", () => {
    expect(totalReturn([1, 1.2, 0.9])).toBeCloseTo(-0.1, 12);
  });

  it("max drawdown is measured from the running peak, not from the start", () => {
    // Peak 1.2, trough 0.9: −25%, though the curve never fell below its start by more than 10%.
    expect(maxDrawdown([1, 1.2, 0.9, 1.1])).toBeCloseTo(-0.25, 12);
    expect(maxDrawdown([1, 1.1, 1.2])).toBe(0);
  });
});
