import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { backtest, DEFAULTS, type Params } from "@/lib/backtest/strategy";
import { twin } from "@/lib/backtest/twin";

const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));

/**
 * The same arithmetic in a different order agrees to rounding, not to the last bit: a
 * billionth is far below anything a bug produces and far above what float noise does.
 */
function agree(a: number[], b: number[]) {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => expect(Math.abs(x / b[i] - 1)).toBeLessThan(1e-9));
}

const RUNS: [string, Params][] = [
  ["the defaults", DEFAULTS],
  ["costs and slippage off", { ...DEFAULTS, costBps: 0, slippageBps: 0 }],
  ["fills at the signal's close", { ...DEFAULTS, fill: "signal-close" }],
  ["a fast pair that trades often", { ...DEFAULTS, fast: 5, slow: 10 }],
];

describe("two engines, one answer", () => {
  it.each(RUNS)("agree on every bar's gross and net with %s", (_, params) => {
    const engine = backtest(spy, params);
    const second = twin(spy, params);
    expect(second.dates).toEqual(engine.dates);
    agree(second.gross, engine.gross);
    agree(second.net, engine.net);
  });

  it("are compared on runs that trade, and on one still holding at the end", () => {
    // A comparison of two flat lines proves nothing. Each run above trades, and the
    // close-out fee at the last bar is exercised by at least one of them.
    for (const [, params] of RUNS) {
      expect(backtest(spy, params).trades.length).toBeGreaterThanOrEqual(2);
    }
    expect(RUNS.some(([, p]) => backtest(spy, p).positions.at(-1) === 1)).toBe(true);
  });
});

/**
 * The same bars with a four-for-one split put in at bar `at`: every raw price before it
 * four times higher, the adjusted column untouched. That is what a split looks like in /eod.
 */
function withSplit(bars: Bar[], at: number): Bar[] {
  return bars.map((b, i) =>
    i < at
      ? { ...b, open: b.open * 4, high: b.high * 4, low: b.low * 4, close: b.close * 4 }
      : b,
  );
}

describe("a split changes nothing", () => {
  // The first bar the default run holds into and through, so the split lands inside a
  // position: that is where a return computed on raw prices would show it.
  const run = backtest(spy, DEFAULTS);
  const start = DEFAULTS.slow - 1;
  const held = run.positions.findIndex((p, i) => i > 0 && p === 1 && run.positions[i - 1] === 1);
  const at = start + held;

  it("is put in while the default run is holding", () => {
    expect(held).toBeGreaterThan(0);
    expect(run.trades.some((t) => t.entryDate < spy[at].date)).toBe(true);
  });

  it("leaves both engines' curves where they were", () => {
    const split = backtest(withSplit(spy, at), DEFAULTS);
    agree(split.gross, run.gross);
    agree(split.net, run.net);
    const second = twin(withSplit(spy, at), DEFAULTS);
    agree(second.gross, run.gross);
    agree(second.net, run.net);
  });

  it("changes the prices the trades were filled at, which are printed prices", () => {
    const split = backtest(withSplit(spy, at), DEFAULTS);
    const before = run.trades.findIndex((t) => t.entryDate < spy[at].date);
    expect(split.trades[before].entryPrice).toBeCloseTo(run.trades[before].entryPrice * 4, 6);
  });
});
