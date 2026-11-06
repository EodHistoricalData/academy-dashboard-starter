import { describe, expect, it } from "vitest";
import { MAX_ADDED, parseAdded, toTicker, withAdded, withoutAdded } from "@/lib/added";

describe("tickers added from the screen", () => {
  it("turns a screener row into a watchlist ticker: the screener drops the exchange", () => {
    expect(toTicker({ code: "BRK-B", exchange: "US" })).toBe("BRK-B.US");
  });

  it("reads only well-formed tickers from the cookie, which anyone can edit", () => {
    expect(parseAdded('["AMZN.US","x;drop","../user","GOOGL.US"]')).toEqual([
      "AMZN.US",
      "GOOGL.US",
    ]);
    expect(parseAdded("not json")).toEqual([]);
    expect(parseAdded(undefined)).toEqual([]);
  });

  it("adds once, removes cleanly, and stops at the cap", () => {
    expect(withAdded(["AMZN.US"], "AMZN.US")).toEqual(["AMZN.US"]);
    expect(withoutAdded(["AMZN.US", "GOOGL.US"], "AMZN.US")).toEqual(["GOOGL.US"]);
    const full = Array.from({ length: MAX_ADDED }, (_, i) => `T${i}.US`);
    expect(withAdded(full, "ONE.US")).toEqual(full);
  });
});
