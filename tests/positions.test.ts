import { describe, expect, it } from "vitest";
import { buyAndHold } from "@/lib/backtest/baseline";
import type { Bar } from "@/lib/backtest/candles";
import { positions as positionsOf } from "@/lib/backtest/positions";
import { backtest, DEFAULTS } from "@/lib/backtest/strategy";

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

// Falls, then rises, then falls: with fast 2 / slow 3 the signal turns on and off once.
const prices = [10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8];
const bars = synthetic(prices);
const params = { fast: 2, slow: 3, costBps: 0 };

describe("positions(signal)", () => {
  it("moves one bar after the signal: the first position is on the bar after it turns true", () => {
    expect(positionsOf([null, null, false, true, true, false, false])).toEqual([0, 0, 0, 0, 1, 1, 0]);
  });
});

describe("positions", () => {
  it("change on the bar after the signal, never on the signal bar", () => {
    const run = backtest(bars, params);
    // Window starts at bar 2 (slow - 1). Signal (fast > slow) first true at bar 5,
    // so the first held bar is 6.
    const firstHeld = run.positions.indexOf(1) + 2;
    expect(firstHeld).toBe(6);
    expect(run.trades[0].entryDate).toBe(bars[5].date);
  });

  it("close an open position on the last bar, so its return is realised", () => {
    const rising = synthetic([10, 9, 8, 9, 10, 11, 12, 13]);
    const run = backtest(rising, { ...params, costBps: 10 });
    expect(run.trades).toHaveLength(1);
    expect(run.trades[0].exitDate).toBe(rising.at(-1)!.date);
    // Charged once in and once out.
    const gross = run.gross.at(-1)!;
    expect(run.net.at(-1)).toBeCloseTo(gross * 0.999 * 0.999, 12);
  });

  it("record each trade with its prices, and its return after costs", () => {
    const run = backtest(bars, params);
    expect(run.trades).toHaveLength(1);
    const t = run.trades[0];
    // Worked by hand: the 2-bar average first beats the 3-bar one at bar 5 (8.5 > 8) and
    // falls behind at bar 10 (10.5 < 11). In at 9, out at 10.
    expect(t).toMatchObject({
      entryDate: bars[5].date,
      entryPrice: 9,
      exitDate: bars[10].date,
      exitPrice: 10,
    });
    expect(t.ret).toBeCloseTo(10 / 9 - 1, 12);
  });
});

describe("costs", () => {
  it("are charged at each position change and grow with turnover", () => {
    const free = backtest(bars, params);
    const paid = backtest(bars, { ...params, costBps: 25 });
    expect(free.net.at(-1)).toBeCloseTo(free.gross.at(-1)!, 12);
    expect(paid.net.at(-1)).toBeCloseTo(free.gross.at(-1)! * 0.9975 ** 2, 12);
  });
});

describe("the comparison", () => {
  it("starts the control on the strategy's first bar, with the same costs", () => {
    const run = backtest(bars, { ...params, costBps: 10 });
    const control = buyAndHold(bars.slice(params.slow - 1), 10);
    expect(control.dates[0]).toBe(run.dates[0]);
    expect(control.dates).toHaveLength(run.dates.length);
  });

  it("reports time in market as the share of bars held", () => {
    const run = backtest(bars, params);
    expect(run.timeInMarket).toBeCloseTo(
      run.positions.filter((p) => p === 1).length / run.positions.length,
      12,
    );
    expect(run.timeInMarket).toBeGreaterThan(0);
    expect(run.timeInMarket).toBeLessThan(1);
  });

  it("uses the textbook defaults, stated before any result", () => {
    expect(DEFAULTS).toEqual({ fast: 20, slow: 50, costBps: 10 });
  });
});
