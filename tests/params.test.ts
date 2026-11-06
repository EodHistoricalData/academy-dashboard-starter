import { describe, expect, it } from "vitest";
import { DEFAULTS } from "@/lib/backtest/engine";
import { neighbours, paramsFrom } from "@/lib/backtest/params";

describe("parameters from the address", () => {
  it("reads each in range and falls back to its default otherwise", () => {
    expect(
      paramsFrom({ fast: "10", slow: "30", costBps: "25", slippageBps: "2", fill: "signal-close" }),
    ).toEqual({ fast: 10, slow: 30, costBps: 25, slippageBps: 2, fill: "signal-close" });
    expect(paramsFrom({ fill: "best-price-in-bar" }).fill).toBe("next-open");
    expect(paramsFrom({ fast: "1e3", slow: "-5", costBps: "abc" })).toEqual(DEFAULTS);
  });

  it("refuses a fast window that is not shorter than the slow one", () => {
    expect(paramsFrom({ fast: "60", slow: "50" })).toEqual(DEFAULTS);
  });
});

describe("neighbours", () => {
  it("are fast ±2 and slow ±5 around the chosen pair, which comes first", () => {
    expect(neighbours(DEFAULTS).map((p) => [p.fast, p.slow])).toEqual([
      [20, 50],
      [18, 50],
      [22, 50],
      [20, 45],
      [20, 55],
    ]);
  });
});
