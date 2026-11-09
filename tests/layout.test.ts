import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, DEFAULT_LAYOUT, parseLayout } from "@/lib/layout";

const at = { x: 0, y: 0, w: 1, h: 1 };

describe("parseLayout", () => {
  it("turns an unknown panel type into a placeholder and keeps the others", () => {
    const layout = parseLayout({
      name: "Morning check",
      version: CURRENT_VERSION,
      panels: [
        { id: "a", type: "heatmap", title: "From a newer version", config: {}, position: at },
        { id: "b", type: "quote", title: "Apple", config: { symbol: "AAPL.US", follows: true }, position: at },
      ],
    });
    expect(layout.panels.map((p) => p.type)).toEqual(["placeholder", "quote"]);
    expect(layout.panels[0]).toMatchObject({ id: "a", title: "From a newer version" });
  });

  it("does not let a quote panel name something that is not a symbol", () => {
    for (const symbol of ["../user", "AAPL", "AAPL.US?api_token=x", 42]) {
      const layout = parseLayout({
        name: "x",
        version: CURRENT_VERSION,
        panels: [{ id: "q", type: "quote", title: "Q", config: { symbol, follows: true }, position: at }],
      });
      expect(layout.panels[0].type).toBe("placeholder");
    }
  });

  it("refuses a screen panel whose filter is not on the allowlist, rather than repairing it", () => {
    const layout = parseLayout({
      name: "x",
      version: CURRENT_VERSION,
      panels: [
        {
          id: "s",
          type: "screen",
          title: "S",
          config: {
            filters: [{ field: "password", op: "=", value: "x" }],
            sort: "market_capitalization.desc",
            follows: false,
          },
          position: at,
        },
      ],
    });
    expect(layout.panels[0].type).toBe("placeholder");
  });

  it("migrates a version 0 document that has no titles, and saves it at the current version", () => {
    const layout = parseLayout({
      name: "Old",
      panels: [{ id: "w", type: "watchlist", config: { symbols: ["AAPL.US"] }, position: at }],
    });
    expect(layout.version).toBe(CURRENT_VERSION);
    expect(layout.panels[0]).toMatchObject({
      type: "watchlist",
      title: "watchlist",
      config: { symbols: ["AAPL.US"], follows: false },
    });
  });

  it("returns the default when the whole document is not a layout", () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout({ panels: "no" })).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
  });

  it("starts a new user with a watchlist, one screen, a quote and the backtest", () => {
    expect(DEFAULT_LAYOUT.panels.map((p) => p.type)).toEqual([
      "watchlist",
      "screen",
      "quote",
      "backtest",
    ]);
  });

  it("gives a version 1 document follows: quote panels follow, the rest stay still", () => {
    const layout = parseLayout({
      name: "v1",
      version: 1,
      panels: [
        { id: "w", type: "watchlist", title: "W", config: { symbols: ["AAPL.US"] }, position: at },
        { id: "q", type: "quote", title: "Q", config: { symbol: "AAPL.US" }, position: at },
      ],
    });
    expect(layout.panels.map((p) => (p.config as { follows: boolean }).follows)).toEqual([
      false,
      true,
    ]);
  });
});

describe("a panel's refresh interval", () => {
  const at = { x: 0, y: 0, w: 1, h: 1 };
  const backtest = { symbol: "SPY.US", fast: 20, slow: 50, costBps: 5, slippageBps: 5, fill: "next-open", follows: false };

  it("defaults by type for a panel saved before intervals existed", () => {
    expect(DEFAULT_LAYOUT.panels.map((p) => p.refresh)).toEqual(["live", "minutes", "live", "manual"]);
    const old = parseLayout({
      ...DEFAULT_LAYOUT,
      panels: DEFAULT_LAYOUT.panels.map((p) => ({ ...p, refresh: undefined })),
    });
    expect(old.panels.map((p) => p.refresh)).toEqual(["live", "minutes", "live", "manual"]);
  });

  it("keeps a backtest manual: any other interval is refused, not repaired", () => {
    const layout = parseLayout({
      name: "x",
      version: CURRENT_VERSION,
      panels: [
        { id: "b", type: "backtest", title: "B", config: backtest, position: at, refresh: "live" },
        { id: "q", type: "quote", title: "Q", config: { symbol: "AAPL.US", follows: true }, position: at, refresh: "daily" },
        { id: "w", type: "quote", title: "W", config: { symbol: "AAPL.US", follows: true }, position: at, refresh: "every second" },
      ],
    });
    expect(layout.panels.map((p) => [p.type, p.refresh])).toEqual([
      ["placeholder", "manual"],
      ["quote", "daily"],
      ["placeholder", "manual"],
    ]);
  });
});
