import { describe, expect, it } from "vitest";
import { maxDrawdown, returnOverDrawdown, timeUnderWater } from "@/lib/backtest/metrics";

// A small equity series worked by hand: peak 1.2 at bar 1, trough 0.9 at bar 3, back
// above 1.2 only at bar 6.
const curve = [1, 1.2, 1.0, 0.9, 1.1, 1.15, 1.25, 1.3];

describe("drawdown, properly", () => {
  it("is measured from the running peak", () => {
    expect(maxDrawdown(curve)).toBeCloseTo(0.9 / 1.2 - 1, 12);
  });

  it("time under water is the longest stretch below a prior peak, in bars", () => {
    // Bars 2, 3, 4, 5 are below 1.2.
    expect(timeUnderWater(curve)).toEqual({ bars: 4, from: 2, to: 5, recovered: true });
  });

  it("an unrecovered stretch runs to the end and says so", () => {
    expect(timeUnderWater([1, 1.2, 1.1, 1.0])).toEqual({
      bars: 2,
      from: 2,
      to: 3,
      recovered: false,
    });
    expect(timeUnderWater([1, 1.1, 1.2]).bars).toBe(0);
  });

  it("return over drawdown is a crude units-of-pain figure, null without a drawdown", () => {
    expect(returnOverDrawdown(curve)).toBeCloseTo(0.3 / 0.25, 12);
    expect(returnOverDrawdown([1, 1.1])).toBeNull();
  });
});
