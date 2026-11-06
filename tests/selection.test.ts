import { describe, expect, it } from "vitest";
import { fromAddress, nextSelection, type Selection, shownSymbol } from "@/lib/selection";

const quotePanel = { id: "quote", config: { symbol: "SPY.US", follows: true } };
const pinned = { id: "pinned", config: { symbol: "SPY.US", follows: false } };

describe("nextSelection", () => {
  it("is a no-op for the symbol already selected: the same object comes back", () => {
    const current: Selection = { symbol: "AAPL.US", source: "watchlist" };
    expect(nextSelection(current, "AAPL.US", "address")).toBe(current);
  });

  it("records a new symbol with the panel that chose it", () => {
    expect(nextSelection({ symbol: null, source: "" }, "MSFT.US", "watchlist")).toEqual({
      symbol: "MSFT.US",
      source: "watchlist",
    });
  });
});

describe("shownSymbol", () => {
  it("a following panel shows the selection, a pinned one its own symbol", () => {
    const sel: Selection = { symbol: "AAPL.US", source: "watchlist" };
    expect(shownSymbol(quotePanel, sel)).toBe("AAPL.US");
    expect(shownSymbol(pinned, sel)).toBe("SPY.US");
  });

  it("never drives a panel with a selection that came from that panel", () => {
    expect(shownSymbol(quotePanel, { symbol: "AAPL.US", source: "quote" })).toBe("SPY.US");
  });

  it("shows its own symbol before anything is selected", () => {
    expect(shownSymbol(quotePanel, { symbol: null, source: "" })).toBe("SPY.US");
  });
});

describe("fromAddress", () => {
  it("accepts only a symbol the page already shows", () => {
    const showing = ["SPY.US", "AAPL.US"];
    expect(fromAddress("AAPL.US", showing)).toBe("AAPL.US");
    expect(fromAddress("TSLA.US", showing)).toBeNull();
    expect(fromAddress("AAPL.US?api_token=x", showing)).toBeNull();
    expect(fromAddress(null, showing)).toBeNull();
  });
});
