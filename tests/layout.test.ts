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
        { id: "b", type: "quote", title: "Apple", config: { symbol: "AAPL.US" }, position: at },
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
        panels: [{ id: "q", type: "quote", title: "Q", config: { symbol }, position: at }],
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
          config: { filters: [{ field: "password", op: "=", value: "x" }], sort: "market_capitalization.desc" },
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
    expect(layout.panels[0]).toMatchObject({ type: "watchlist", title: "watchlist" });
  });

  it("returns the default when the whole document is not a layout", () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout({ panels: "no" })).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
  });

  it("starts a new user with a watchlist, one screen and the backtest", () => {
    expect(DEFAULT_LAYOUT.panels.map((p) => p.type)).toEqual(["watchlist", "screen", "backtest"]);
  });
});
