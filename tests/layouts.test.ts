import { describe, expect, it } from "vitest";
import { putDocViaRoute } from "@/lib/doc-client";
import { DEFAULT_LAYOUT, MARKETS_LAYOUT, parseLayout } from "@/lib/layout";
import { exportLayout, layoutsFrom, resolveLayout, withPanelConfig } from "@/lib/layouts";

const morning = { ...DEFAULT_LAYOUT, name: "Morning check" };
const earnings = { ...DEFAULT_LAYOUT, name: "Earnings week", panels: DEFAULT_LAYOUT.panels.slice(0, 2) };

describe("resolveLayout", () => {
  it("opens the default for a name it does not have, never an error", () => {
    const saved = { [earnings.name]: earnings };
    expect(resolveLayout(saved, "Earnings week")).toBe(earnings);
    expect(resolveLayout(saved, "made-up")).toBe(DEFAULT_LAYOUT);
    expect(resolveLayout(saved, null)).toBe(DEFAULT_LAYOUT);
    expect(resolveLayout(saved, "__proto__")).toBe(DEFAULT_LAYOUT);
  });
});

describe("layoutsFrom", () => {
  it("checks every panel of every layout again on the way in, keyed by name", () => {
    const stored = {
      "Earnings week": {
        ...earnings,
        panels: [{ ...earnings.panels[0], type: "quote", config: { symbol: "../user", follows: true } }],
      },
    };
    const layouts = layoutsFrom(stored);
    expect(Object.keys(layouts)).toEqual(["Earnings week", "Morning check", "Markets"]);
    expect(layouts["Earnings week"].panels[0].type).toBe("placeholder");
  });

  it("starts from the built-in layouts when nothing is stored", () => {
    expect(layoutsFrom(null)).toEqual({
      [DEFAULT_LAYOUT.name]: DEFAULT_LAYOUT,
      [MARKETS_LAYOUT.name]: MARKETS_LAYOUT,
    });
  });

  it("offers every built-in the document does not have by name; a saved one of that name wins", () => {
    const mine = { ...earnings, name: "Markets" };
    const layouts = layoutsFrom({ Markets: mine });
    expect(Object.keys(layouts)).toEqual(["Markets", "Morning check"]);
    expect(layouts.Markets.panels.map((p) => p.type)).toEqual(["watchlist", "screen"]);
  });

  it("opens a built-in by its name, and still the default for a name nobody has", () => {
    const layouts = layoutsFrom(null);
    expect(resolveLayout(layouts, "Markets")).toBe(MARKETS_LAYOUT);
    expect(resolveLayout(layouts, "made-up")).toBe(DEFAULT_LAYOUT);
  });
});

describe("withPanelConfig", () => {
  it("changes the one panel it was given, even when another has the same id", () => {
    const at = { x: 0, y: 0, w: 2, h: 1 };
    const layout = parseLayout({
      name: "Twins",
      version: 2,
      panels: [
        { id: "same", type: "portfolio", title: "P", config: { trades: [], follows: false }, position: at },
        { id: "same", type: "watchlist", title: "W", config: { symbols: ["AAPL.US"], follows: false }, position: at },
      ],
    });
    const trade = { id: "1", symbol: "AAPL.US", side: "buy", date: "2026-01-05", quantity: 1, price: 100, fees: 0 };
    const next = withPanelConfig(layout, layout.panels[0], { trades: [trade], follows: false });
    expect(next.panels[0].config).toEqual({ trades: [trade], follows: false });
    expect(next.panels[1]).toBe(layout.panels[1]);
    // Read back, both still pass their own type's check.
    expect(parseLayout(next).panels.map((p) => p.type)).toEqual(["portfolio", "watchlist"]);
  });
});

describe("autosave", () => {
  it("meets a newer version and says so, carrying what the other tab saved", async () => {
    const server = async () =>
      Response.json(
        { error: "Your other tab is ahead", current: { version: 4, payload: { [morning.name]: morning } } },
        { status: 409 },
      );
    const outcome = await putDocViaRoute("layouts", 3, {}, server as typeof fetch);
    expect(outcome).toEqual({ kind: "conflict", current: { version: 4, payload: { [morning.name]: morning } } });
  });

  it("returns the new version when the write lands, and a failure when the store is unreachable", async () => {
    const ok = async () => Response.json({ version: 8 });
    expect(await putDocViaRoute("layouts", 7, {}, ok as typeof fetch)).toEqual({ kind: "saved", version: 8 });
    const down = async () => {
      throw new TypeError("network");
    };
    expect(await putDocViaRoute("layouts", 7, {}, down as typeof fetch)).toEqual({ kind: "failed", status: null });
  });
});

describe("exportLayout", () => {
  it("is one layout as JSON: name, version and panels, nothing else", () => {
    const parsed = JSON.parse(exportLayout({ ...morning, extra: "secret" } as never));
    expect(Object.keys(parsed)).toEqual(["name", "version", "panels"]);
    expect(Object.keys(parsed.panels[0])).toEqual(["id", "type", "title", "config", "position"]);
  });
});
