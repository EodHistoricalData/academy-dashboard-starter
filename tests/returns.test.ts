import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { compound, dailyReturns, largestMoves, parseSplit } from "@/lib/backtest/returns";

// Five AAPL bars across the 2020-08-31 four-for-one split, as the lesson quotes them.
const aapl2020: Bar[] = [
  ["2020-08-27", 500.04, 121.1519],
  ["2020-08-28", 499.23, 120.9557],
  ["2020-08-31", 129.04, 125.0575],
  ["2020-09-01", 134.18, 130.0389],
  ["2020-09-02", 131.4, 127.3447],
].map(([date, close, adjusted_close]) => ({
  date: date as string,
  open: close as number,
  high: close as number,
  low: close as number,
  close: close as number,
  adjusted_close: adjusted_close as number,
  volume: 0,
}));

describe("returns", () => {
  it("read the split as a −74.2% day on raw close, and +3.4% on adjusted", () => {
    const raw = dailyReturns(aapl2020, "close").find((x) => x.date === "2020-08-31")!;
    const adj = dailyReturns(aapl2020, "adjusted_close").find(
      (x) => x.date === "2020-08-31",
    )!;
    expect(raw.r).toBeCloseTo(-0.742, 3);
    expect(adj.r).toBeCloseTo(0.034, 3);
  });

  it("start at the second bar: the first has nothing before it", () => {
    const r = dailyReturns(aapl2020, "adjusted_close");
    expect(r).toHaveLength(4);
    expect(r[0].date).toBe("2020-08-28");
  });

  it("put the split at the top of the raw list and nowhere in the adjusted one", () => {
    expect(largestMoves(dailyReturns(aapl2020, "close"), 1)[0].date).toBe("2020-08-31");
    expect(
      largestMoves(dailyReturns(aapl2020, "adjusted_close"), 1)[0].r,
    ).toBeLessThan(0.05);
  });
});

describe("compounding", () => {
  it("multiplies: −50% then +50% is −25%, not flat", () => {
    expect(compound([-0.5, 0.5]).at(-1)).toBeCloseTo(0.75, 10);
  });

  it("starts the curve at 1, before the first return", () => {
    expect(compound([0.1])).toEqual([1, 1.1]);
  });
});

describe("parseSplit", () => {
  it("reads the ratio the splits endpoint sends as a string", () => {
    expect(parseSplit("4.000000/1.000000")).toBe(4);
    expect(parseSplit("1/10")).toBeCloseTo(0.1, 10);
    expect(parseSplit("4:1")).toBeNull();
  });
});
