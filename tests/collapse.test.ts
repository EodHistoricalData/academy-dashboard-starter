import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, parseLayout } from "@/lib/layout";
import { neededBy, unionNeeds } from "@/lib/panels";

describe("a collapsed panel", () => {
  it("adds nothing to the union of needs", () => {
    const panels = [
      { collapsed: false, needs: { quotes: ["AAPL.US", "MSFT.US"] } },
      { collapsed: true, needs: { quotes: ["TSLA.US"] } },
    ];
    const needs = neededBy(panels, (p) => p.needs);
    expect(unionNeeds(needs)).toEqual(["AAPL.US", "MSFT.US"]);
  });

  it("is saved with the layout, and read back", () => {
    const stored = {
      ...DEFAULT_LAYOUT,
      panels: DEFAULT_LAYOUT.panels.map((p, i) => ({ ...p, collapsed: i === 1 })),
    };
    expect(parseLayout(stored).panels.map((p) => p.collapsed)).toEqual([false, true, false, false]);
  });
});
