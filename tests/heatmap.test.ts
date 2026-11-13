import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeatmapPanel } from "@/components/panels/HeatmapPanel";
import { ScreenPanel } from "@/components/panels/ScreenPanel";
import { DEFAULT_SORT } from "@/lib/filters";
import {
  changeColor,
  changeOf,
  formatChange,
  type Rect,
  squarify,
  type Tile,
  treemap,
} from "@/lib/heatmap";
import { MARKETS_LAYOUT, parseLayout } from "@/lib/layout";
import { screenKey } from "@/lib/proxy-fetch";
import { MY_FILTERS, type ScreenRow, toScreenRows } from "@/lib/screen-query";

const area = (r: Rect) => r.w * r.h;

/** How much two rectangles overlap, as an area: touching edges is zero. */
function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

function inside(t: Rect, r: Rect, eps = 1e-9): boolean {
  return (
    t.x >= r.x - eps &&
    t.y >= r.y - eps &&
    t.x + t.w <= r.x + r.w + eps &&
    t.y + t.h <= r.y + r.h + eps
  );
}

describe("squarify", () => {
  // The paper's own example, in a rect that does not start at the origin.
  const rect: Rect = { x: 10, y: 20, w: 600, h: 400 };
  const items = [6, 6, 4, 3, 2, 2, 1].map((weight, i) => ({ key: `k${i}`, weight }));
  const tiles = squarify(items, rect);

  it("gives every item a tile with an area in proportion to its weight", () => {
    expect(tiles.map((t) => t.key).sort()).toEqual(items.map((i) => i.key).sort());
    for (const t of tiles) {
      const expected = (t.weight / 24) * area(rect);
      expect(Math.abs(area(t) - expected) / expected).toBeLessThan(1e-9);
    }
  });

  it("fills the rect, stays inside it, and no two tiles overlap", () => {
    const total = tiles.reduce((s, t) => s + area(t), 0);
    expect(Math.abs(total - area(rect)) / area(rect)).toBeLessThan(1e-9);
    for (const t of tiles) expect(inside(t, rect)).toBe(true);
    for (const [i, a] of tiles.entries()) {
      for (const b of tiles.slice(i + 1)) expect(overlap(a, b)).toBeLessThan(1e-6);
    }
  });

  it("places the largest first", () => {
    const weights = tiles.map((t) => t.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("draws a weight that is zero, negative or not a number as a sliver, not a gap", () => {
    const odd = squarify(
      [
        { key: "big", weight: 1e12 },
        { key: "zero", weight: 0 },
        { key: "negative", weight: -5 },
        { key: "nan", weight: Number.NaN },
        { key: "infinite", weight: Number.POSITIVE_INFINITY },
      ],
      rect,
    );
    const byKey = new Map(odd.map((t): [string, Tile] => [t.key, t]));
    expect(byKey.size).toBe(5);
    for (const key of ["zero", "negative", "nan", "infinite"]) {
      const t = byKey.get(key)!;
      expect(t.weight).toBe(1);
      expect(t.w).toBeGreaterThan(0);
      expect(t.h).toBeGreaterThan(0);
      expect(inside(t, rect)).toBe(true);
    }
  });

  it("returns nothing for nothing", () => {
    expect(squarify([], rect)).toEqual([]);
  });
});

const row = (
  code: string,
  sector: string | null,
  cap: number,
  change: number | null,
): ScreenRow => ({
  code,
  name: code,
  last_day_data_date: "2026-10-30",
  adjusted_close: 100,
  refund_1d_p: change,
  market_capitalization: cap,
  earnings_share: 1,
  dividend_yield: null,
  sector,
  currency_symbol: "$",
  exchange: "US",
});

const ROWS: ScreenRow[] = [
  row("NVDA", "Technology", 4551e9, 2.55),
  row("MSFT", "Technology", 3809e9, -0.67),
  row("GOOGL", "Communication Services", 3004e9, 0.41),
  row("BRK-B", "Financial Services", 1056e9, null),
  row("JPM", "Financial Services", 851e9, 0),
  row("XYZ", null, 300e9, 0.04),
];

describe("treemap", () => {
  const rect: Rect = { x: 0, y: 0, w: 640, h: 360 };
  const { sectors, tiles } = treemap(ROWS, rect);

  it("groups rows by sector, largest sector first, a missing sector as Unclassified", () => {
    expect(sectors.map((s) => s.sector)).toEqual([
      "Technology",
      "Communication Services",
      "Financial Services",
      "Unclassified",
    ]);
    expect(tiles.filter((t) => t.sector === "Technology").map((t) => t.row.code)).toEqual([
      "NVDA",
      "MSFT",
    ]);
    expect(tiles).toHaveLength(ROWS.length);
  });

  it("gives each sector an area in proportion to its summed capitalisation", () => {
    const total = ROWS.reduce((s, r) => s + r.market_capitalization, 0);
    for (const s of sectors) {
      const cap = ROWS.filter((r) => (r.sector ?? "Unclassified") === s.sector).reduce(
        (sum, r) => sum + r.market_capitalization,
        0,
      );
      const expected = (cap / total) * area(rect);
      expect(Math.abs(area(s) - expected) / expected).toBeLessThan(1e-9);
    }
  });

  it("puts each sector's rows inside it, below the strip its name sits in", () => {
    for (const t of tiles) {
      const s = sectors.find((x) => x.sector === t.sector)!;
      expect(inside(t, { x: s.x, y: s.y + s.strip, w: s.w, h: s.h - s.strip })).toBe(true);
    }
    expect(sectors[0].strip).toBe(14);
  });
});

describe("changeOf", () => {
  it("is null, not 0, for a row without a change", () => {
    expect(changeOf({})).toBeNull();
    expect(changeOf({ refund_1d_p: null })).toBeNull();
    expect(changeOf({ refund_1d_p: Number.NaN })).toBeNull();
    expect(changeOf({ refund_1d_p: 0 })).toBe(0);
    expect(changeOf({ refund_1d_p: -0.67 })).toBe(-0.67);
  });
});

describe("changeColor", () => {
  it("colours the change as it is shown, rounded to one decimal", () => {
    const cases: [number | null, string][] = [
      [null, "#475569"],
      [5, "#128651"],
      [3, "#128651"],
      [2.95, "#128651"], // shown as +3.0%
      [2.94, "#177a44"],
      [1, "#177a44"],
      [0.95, "#177a44"], // shown as +1.0%, though 0.95.toFixed(1) is "0.9"
      [0.94, "#35684f"],
      [0.05, "#35684f"], // shown as +0.1%
      [0.04, "#475569"], // shown as 0.0%
      [0, "#475569"],
      [-0.04, "#475569"], // −0.0% is 0.0%: grey, not red
      [-0.05, "#a44148"],
      [-0.94, "#a44148"],
      [-0.95, "#b93e3e"], // shown as −1.0%
      [-1, "#b93e3e"],
      [-2.94, "#b93e3e"],
      [-2.95, "#cb4242"], // shown as −3.0%
      [-3, "#cb4242"],
      [-8, "#cb4242"],
    ];
    for (const [change, colour] of cases) expect([change, changeColor(change)]).toEqual([change, colour]);
  });

  it("prints the same rounding it colours by", () => {
    expect(formatChange(2.55)).toBe("+2.6%");
    expect(formatChange(0.95)).toBe("+1.0%");
    expect(formatChange(-0.67)).toBe("−0.7%");
    expect(formatChange(-0.04)).toBe("0.0%");
    expect(formatChange(null)).toBe("—");
  });

  it("leaves white label text at least 4.5:1 on every fill", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const fills = new Set([5, 2, 0.5, 0, -0.5, -2, -5, null].map(changeColor));
    expect(fills.size).toBe(7);
    for (const fill of fills) {
      expect(1.05 / (luminance(fill) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the heatmap panel", () => {
  const config = { filters: MY_FILTERS, sort: DEFAULT_SORT, follows: false };

  it("asks for the same screen as a screen panel with the same filters and sort: one request", () => {
    const heat = HeatmapPanel.dataNeeds({ ...config, follows: true });
    const screen = ScreenPanel.dataNeeds(config);
    expect(heat.quotes).toEqual([]);
    expect(screenKey(heat.screen!)).toBe(screenKey(screen.screen!));
  });

  it("renders literal rows with no mock and no network, a missing change as a dash", () => {
    const html = renderToString(
      createElement(HeatmapPanel.Component, {
        config,
        data: {
          quotes: [],
          screen: { rows: ROWS, fetchedAt: 0 },
          bars: null,
          notes: {},
          selected: "NVDA.US",
        },
        onSelect: () => {},
        onConfigChange: () => {},
      }),
    );
    expect(html).toContain('viewBox="0 0 640 360"');
    expect(html).toContain('aria-label="NVDA, Technology, up 2.6% today"');
    expect(html).toContain('aria-label="MSFT, Technology, down 0.7% today"');
    expect(html).toContain('aria-label="JPM, Financial Services, unchanged today"');
    expect(html).toContain('aria-label="BRK-B, Financial Services, change unknown"');
    expect(html).toContain(">+2.6%<");
    expect(html).toContain(">−0.7%<");
    expect(html).toContain(">—<"); // BRK-B: the tile is large enough to print its label
    expect(html).toContain(">Technology<");
    // The selected tile, and only it, is marked.
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*aria-label="NVDA|aria-label="NVDA[^>]*aria-current="true"/);
  });

  it("says why when the screen has no rows", () => {
    const html = renderToString(
      createElement(HeatmapPanel.Component, {
        config,
        data: { quotes: [], screen: { rows: [], fetchedAt: 0 }, bars: null, notes: {}, selected: null },
        onSelect: () => {},
        onConfigChange: () => {},
      }),
    );
    expect(html).toContain("Nothing matches these filters.");
  });

  it("is fed rows that carry sector, capitalisation and change, as the proxy hands them over", () => {
    const rows = toScreenRows(JSON.parse(readFileSync("fixtures/screener.json", "utf8")));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(typeof r.sector).toBe("string");
      expect(r.market_capitalization).toBeGreaterThan(0);
      expect(typeof r.refund_1d_p).toBe("number");
    }
  });
});

describe("the Markets layout", () => {
  it("passes its own check: a heatmap of my screen by size, and a quote that follows", () => {
    expect(parseLayout(MARKETS_LAYOUT)).toEqual(MARKETS_LAYOUT);
    const [heat, quote] = MARKETS_LAYOUT.panels;
    expect(heat).toMatchObject({
      type: "heatmap",
      config: { filters: MY_FILTERS, sort: "market_capitalization.desc" },
    });
    expect(quote).toMatchObject({ type: "quote", config: { follows: true } });
  });

  it("refuses a heatmap whose filter is not on the allowlist, as it would a screen", () => {
    const layout = parseLayout({
      ...MARKETS_LAYOUT,
      panels: [
        {
          ...MARKETS_LAYOUT.panels[0],
          config: { filters: [{ field: "api_token", op: "=", value: 1 }], sort: DEFAULT_SORT, follows: false },
        },
      ],
    });
    expect(layout.panels[0].type).toBe("placeholder");
  });
});
