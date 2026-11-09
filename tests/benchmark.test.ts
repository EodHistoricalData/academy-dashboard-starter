import { describe, expect, it } from "vitest";
import { timeInMarket } from "@/lib/backtest/metrics";

describe("timeInMarket", () => {
  it("is the share of bars that ended holding", () => {
    expect(timeInMarket([0, 1, 1, 0])).toBe(0.5);
    expect(timeInMarket([1, 1, 1])).toBe(1);
  });

  it("is zero for no bars, not NaN", () => {
    expect(timeInMarket([])).toBe(0);
  });
});
