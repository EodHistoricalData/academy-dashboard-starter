import { describe, expect, it } from "vitest";
import {
  clampLimit,
  filterParam,
  parseFilterParam,
  safe,
  toTriples,
} from "@/lib/filters";

describe("safe", () => {
  it("accepts a filter on the list", () => {
    expect(safe({ field: "dividend_yield", op: ">", value: 0.02 })).toEqual({
      field: "dividend_yield",
      op: ">",
      value: 0.02,
    });
    expect(safe({ field: "sector", op: "=", value: "Energy" })).not.toBeNull();
  });

  it("rejects rather than repairs", () => {
    expect(safe({ field: "Market_Capitalization", op: ">", value: 1 })).toBeNull();
    expect(safe({ field: "market_capitalization", op: "LIKE", value: 1 })).toBeNull();
    expect(safe({ field: "market_capitalization", op: ">", value: "1e9" })).toBeNull();
    expect(safe({ field: "sector", op: ">", value: "Energy" })).toBeNull();
    expect(safe({ field: "sector", op: "=", value: "Energy'; drop" })).toBeNull();
  });
});

describe("the universe", () => {
  it("is added by the code, after the person's filters", () => {
    expect(toTriples([{ field: "earnings_share", op: ">", value: 0 }])).toEqual([
      ["earnings_share", ">", 0],
      ["exchange", "=", "us"],
    ]);
  });
});

describe("the address bar", () => {
  it("round-trips a screen", () => {
    const filters = [
      { field: "market_capitalization", op: ">", value: 1000000000 },
      { field: "sector", op: "=", value: "Communication Services" },
    ] as const;
    const f = filterParam([...filters]);
    expect(f).toBe(
      "market_capitalization:gt:1000000000,sector:eq:Communication Services",
    );
    expect(parseFilterParam(f)).toEqual({ filters, dropped: [] });
  });

  it("drops what a stranger's link adds, and says what it dropped", () => {
    expect(
      parseFilterParam("market_capitalization:gt:1e9,password:eq:x,dividend_yield:like:2,earnings_share:gt:"),
    ).toEqual({
      filters: [{ field: "market_capitalization", op: ">", value: 1e9 }],
      dropped: ["password:eq:x", "dividend_yield:like:2", "earnings_share:gt:"],
    });
  });
});

describe("clampLimit", () => {
  // Worked out by hand from Math.min(Math.max(Number(raw) || 25, 1), 100).
  it("caps a large number, defaults a non-number", () => {
    expect(clampLimit("500")).toBe(100);
    expect(clampLimit("abc")).toBe(25);
    expect(clampLimit(undefined)).toBe(25);
    expect(clampLimit("-3")).toBe(1);
  });
});
