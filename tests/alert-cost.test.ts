import { describe, expect, it } from "vitest";
import { alertCosts } from "../scripts/alert-cost";

describe("alertCosts", () => {
  it("prices three symbols at 3, 78 and 390 calls a day", () => {
    expect(alertCosts(["AAPL.US", "MSFT.US", "NVDA.US"]).map((r) => r.perDay)).toEqual([3, 78, 390]);
  });

  it("grows in proportion with the symbols", () => {
    const five = ["A.US", "B.US", "C.US", "D.US", "E.US"];
    expect(alertCosts(five).map((r) => r.perDay)).toEqual([5, 130, 650]);
  });

  it("costs nothing for no symbols", () => {
    expect(alertCosts([])).toEqual([]);
  });
});
