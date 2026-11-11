import { describe, expect, it } from "vitest";
import type { Quote } from "@/lib/quotes";
import type { Row } from "@/lib/rows";
import { sortRows } from "@/lib/sort";

function quote(code: string, change_p: number, volume: number | null = 1000): Quote {
  return {
    code,
    timestamp: 1793390400,
    close: 100,
    previousClose: 100,
    change: 0,
    change_p,
    volume,
  };
}

describe("sortRows", () => {
  it("gives tied rows the same order whichever order they arrived in", () => {
    const a = quote("MSFT.US", 0.32);
    const b = quote("AAPL.US", 0.32);
    expect(sortRows([a, b], "change_p", []).map((r) => r.code)).toEqual([
      "AAPL.US",
      "MSFT.US",
    ]);
    expect(sortRows([b, a], "change_p", []).map((r) => r.code)).toEqual([
      "AAPL.US",
      "MSFT.US",
    ]);
  });

  it("puts the biggest move first by size of change %, up or down, not by price", () => {
    const rows = [quote("SPY.US", 0.34), quote("NVDA.US", 2.55), quote("MSFT.US", -0.67)];
    expect(sortRows(rows, "change_p", []).map((r) => r.code)).toEqual([
      "NVDA.US",
      "MSFT.US",
      "SPY.US",
    ]);
  });

  it("rebuilds manual order from my list, not from the response", () => {
    const rows = [quote("MSFT.US", 0), quote("AAPL.US", 0)];
    expect(sortRows(rows, "manual", ["AAPL.US", "MSFT.US"]).map((r) => r.code)).toEqual([
      "AAPL.US",
      "MSFT.US",
    ]);
  });

  it("keeps rows without prices, after the ones it can rank", () => {
    const rows: Row[] = [
      { code: "005930.KO", status: "unavailable" },
      quote("AAPL.US", 1, 50),
      quote("MSFT.US", 1, null),
    ];
    expect(sortRows(rows, "volume", []).map((r) => r.code)).toEqual([
      "AAPL.US",
      "MSFT.US",
      "005930.KO",
    ]);
  });

  it("does not reorder the array it was given", () => {
    const rows = [quote("MSFT.US", -1), quote("AAPL.US", 1)];
    sortRows(rows, "change_p", []);
    expect(rows.map((r) => r.code)).toEqual(["MSFT.US", "AAPL.US"]);
  });
});
