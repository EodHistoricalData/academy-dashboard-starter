import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WatchlistPanel } from "@/components/panels/WatchlistPanel";
import { unionNeeds } from "@/lib/panels";

describe("the container's union", () => {
  it("asks once for a symbol two panels need", () => {
    expect(
      unionNeeds([
        WatchlistPanel.dataNeeds({ symbols: ["AAPL.US", "MSFT.US"], follows: false }),
        WatchlistPanel.dataNeeds({ symbols: ["MSFT.US", "NVDA.US"], follows: false }),
      ]),
    ).toEqual(["AAPL.US", "MSFT.US", "NVDA.US"]);
  });
});

describe("the watchlist panel", () => {
  it("renders a literal row and its note with no mock and no network", () => {
    const html = renderToString(
      createElement(WatchlistPanel.Component, {
        config: { symbols: ["AAPL.US"], follows: false },
        data: {
          quotes: [
            {
              row: {
                code: "AAPL.US",
                timestamp: 1793390400,
                close: 251.32,
                previousClose: 248.9,
                change: 2.42,
                change_p: 0.9723,
                volume: 48211370,
              },
              fetchedAt: 0,
            },
          ],
          screen: null,
          bars: null,
          notes: { "AAPL.US": { note: "Bought at 291" } },
          selected: null,
        },
        onSelect: () => {},
        onConfigChange: () => {},
      }),
    );
    expect(html).toContain("AAPL.US");
    expect(html).toContain("251.32");
    expect(html).toContain("+2.42 (+0.97%)");
    expect(html).toContain("Bought at 291");
  });
});
