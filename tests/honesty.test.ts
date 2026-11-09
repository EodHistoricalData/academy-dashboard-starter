import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { backtest, DEFAULTS } from "@/lib/backtest/strategy";
import { shuffled } from "@/lib/backtest/shuffle";
import { signals } from "@/lib/backtest/signal";

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

describe("3. shuffle (a null test, not a leak test)", () => {
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
