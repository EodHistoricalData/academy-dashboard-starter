import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { DEFAULTS } from "@/lib/backtest/strategy";
import { GRID, outOfSample, splitIndex, tune } from "@/lib/backtest/split";

const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));

describe("in-sample, then out-of-sample once", () => {
  it("splits by date, 70% first", () => {
    expect(splitIndex(spy)).toBe(175);
  });

  it("tunes without seeing the out-of-sample bars", () => {
    const split = splitIndex(spy);
    const choice = tune(spy, split, DEFAULTS).best;
    const futureChanged = spy.map((b, i) =>
      i >= split ? { ...b, adjusted_close: b.adjusted_close * (i % 2 ? 2 : 0.5) } : b,
    );
    expect(tune(futureChanged, split, DEFAULTS).best).toEqual(choice);
  });

  it("tries every pair on the grid that fits, and reports how many", () => {
    const { tried } = tune(spy, splitIndex(spy), DEFAULTS);
    expect(tried).toHaveLength(GRID.fast.length * GRID.slow.length);
  });

  it("starts the out-of-sample run at the split date", () => {
    const split = splitIndex(spy);
    const run = outOfSample(spy, DEFAULTS, split);
    expect(run.dates[0]).toBe(spy[split].date);
  });
});
