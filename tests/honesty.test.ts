import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { backtest, costShare, DEFAULTS } from "@/lib/backtest/engine";
import { fillsOutsideRange, shuffled } from "@/lib/backtest/honesty";
import { signals } from "@/lib/backtest/strategy";

const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));
const k = 150;

describe("1. future mutation", () => {
  it("leaves every signal up to bar k bit-identical when bars after k are nonsense", () => {
    const before = signals(spy, DEFAULTS);
    const nonsense = spy.map((b, i) =>
      i > k ? { ...b, adjusted_close: 1 + (i % 7) * 1000, close: 1 + (i % 7) * 1000 } : b,
    );
    const after = signals(nonsense, DEFAULTS);
    expect(after.slice(0, k + 1)).toEqual(before.slice(0, k + 1));
  });
});

describe("2. truncation", () => {
  it("gives the same signals and positions through bar k with or without later data", () => {
    const short = backtest(spy.slice(0, k + 1), DEFAULTS);
    const full = backtest(spy, DEFAULTS);
    const through = short.positions.length; // window bars up to and including k
    expect(full.signals.slice(0, through)).toEqual(short.signals);
    expect(full.positions.slice(0, through)).toEqual(short.positions);
  });
});

describe("3. fill range", () => {
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

describe("4. shuffle (a null test, not a leak test)", () => {
  it("keeps the dates and the set of daily moves, and changes only their order", () => {
    const s = shuffled(spy, 42);
    expect(s.map((b) => b.date)).toEqual(spy.map((b) => b.date));
    const moves = (bars: Bar[]) =>
      bars
        .slice(1)
        .map((b, i) => +(b.adjusted_close / bars[i].adjusted_close).toFixed(10))
        .sort();
    expect(moves(s)).toEqual(moves(spy));
    expect(s.map((b) => b.adjusted_close)).not.toEqual(spy.map((b) => b.adjusted_close));
    expect(shuffled(spy, 42)).toEqual(s); // seeded: the same run twice
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

describe("cost share", () => {
  it("is what was paid, as a share of the start and of the gross gain", () => {
    const run = backtest(spy, DEFAULTS);
    const gross = run.gross.at(-1)! - 1;
    const net = run.net.at(-1)! - 1;
    const share = costShare(run);
    expect(share.ofStart).toBeCloseTo(gross - net, 12);
    expect(share.ofGross).toBeCloseTo((gross - net) / gross, 12);
  });

});
