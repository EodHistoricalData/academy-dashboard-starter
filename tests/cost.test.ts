import { describe, expect, it } from "vitest";
import { estimateCalls } from "@/lib/cost";
import { pageLoadCalls, quotesRequest } from "@/lib/quotes";
import { MY_SCREEN, screenPageCalls } from "@/lib/screens";
import { WATCHLIST } from "@/lib/watchlist";

describe("estimateCalls", () => {
  it("charges news five calls per ticker", () => {
    expect(estimateCalls("news", { s: "AAPL.US" })).toBe(5);
    expect(estimateCalls("news", { s: "AAPL.US,MSFT.US" })).toBe(10);
    expect(estimateCalls("news", { t: "technology" })).toBe(5);
  });

  it("charges real-time once per symbol in s", () => {
    expect(estimateCalls("real-time", { s: "A,B,C" })).toBe(3);
  });

  it("counts the symbol in the path as well as those in s", () => {
    expect(estimateCalls("real-time/AAPL.US", { s: "MSFT.US,NVDA.US" })).toBe(3);
    expect(estimateCalls("real-time/AAPL.US")).toBe(1);
  });

  it("charges flat-rate endpoints per request, not per row", () => {
    expect(estimateCalls("eod/AAPL.US", { from: "2000-01-01" })).toBe(1);
    expect(estimateCalls("div/AAPL.US")).toBe(1);
    expect(estimateCalls("exchange-symbol-list/US")).toBe(1);
    expect(estimateCalls("screener")).toBe(5);
    expect(estimateCalls("intraday/AAPL.US", { interval: "5m" })).toBe(5);
    expect(estimateCalls("fundamentals/AAPL.US")).toBe(10);
    expect(estimateCalls("mp/unicornbay/options/eod")).toBe(10);
  });

  it("knows that reading the plan is free", () => {
    expect(estimateCalls("user")).toBe(0);
  });

  it("says null, not zero, for an endpoint it does not know", () => {
    expect(estimateCalls("bulk-fundamentals/US")).toBeNull();
  });
});

describe("the page's own cost", () => {
  it("is one call per watchlist ticker, from the request quotes() really sends", () => {
    const req = quotesRequest(WATCHLIST);
    expect(req).not.toBeNull();
    expect(estimateCalls(req!.path, req!.params)).toBe(WATCHLIST.length);
    expect(pageLoadCalls(WATCHLIST)).toBe(WATCHLIST.length);
  });

  it("is nothing for an empty watchlist", () => {
    expect(pageLoadCalls([])).toBe(0);
  });
});

describe("the screen page's cost", () => {
  // Measured: one /screener request is 5 calls and reading the plan is free. If this
  // fails, a change added a fetch to the page: say what it is for before raising the 5.
  it("is 5 calls, whatever the limit", () => {
    expect(screenPageCalls(MY_SCREEN)).toBe(5);
    expect(screenPageCalls({ ...MY_SCREEN, limit: 100 })).toBe(5);
  });
});
