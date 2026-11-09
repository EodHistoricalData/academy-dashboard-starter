import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { fillsOutsideRange } from "@/lib/backtest/shuffle";
import { backtest, DEFAULTS } from "@/lib/backtest/strategy";

const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));

describe("fill range", () => {
  it("fills every trade inside its bar's low-to-high, at the next open or the close", () => {
    for (const fill of ["next-open", "signal-close"] as const) {
      const run = backtest(spy, { ...DEFAULTS, fill });
      expect(run.fills.length).toBeGreaterThan(0);
      expect(fillsOutsideRange(spy, run)).toEqual([]);
    }
  });

  it("catches a fill taken from the wrong day", () => {
    const run = backtest(spy, DEFAULTS);
    const moved = { ...run, fills: run.fills.map((f) => ({ ...f, price: f.price * 1.05 })) };
    expect(fillsOutsideRange(spy, moved).length).toBeGreaterThan(0);
  });
});

describe("next open, against you", () => {
  it("fills an entry at the next bar's open, and charges slippage on top of cost", () => {
    const run = backtest(spy, DEFAULTS);
    const first = run.fills[0];
    expect(first.at).toBe("open");
    expect(first.price).toBe(spy[first.bar].open);
    const noSlip = backtest(spy, { ...DEFAULTS, slippageBps: 0 });
    expect(run.net.at(-1)!).toBeLessThan(noSlip.net.at(-1)!);
  });

  it("is a different number from filling at the signal close", () => {
    const close = backtest(spy, { ...DEFAULTS, fill: "signal-close" });
    const open = backtest(spy, DEFAULTS);
    expect(open.net.at(-1)).not.toBeCloseTo(close.net.at(-1)!, 6);
  });
});
