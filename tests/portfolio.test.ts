import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeatmapPanel } from "@/components/panels/HeatmapPanel";
import { PortfolioPanel } from "@/components/panels/PortfolioPanel";
import { QuotePanel } from "@/components/panels/QuotePanel";
import { SentimentPanel } from "@/components/panels/SentimentPanel";
import { estimateCalls } from "@/lib/cost";
import { toTriples } from "@/lib/filters";
import { MARKETS_LAYOUT, parseLayout } from "@/lib/layout";
import { type Needs, sentimentKey, unionNeeds } from "@/lib/panels";
import {
  checkTrades,
  dayChange,
  openLots,
  parseTrades,
  positions,
  type Trade,
} from "@/lib/portfolio";
import { screenKey } from "@/lib/proxy-fetch";
import { quotesRequest } from "@/lib/quote-request";
import { toRows } from "@/lib/rows";
import { PAGE_LIMIT, screenCalls } from "@/lib/screen-query";

let next = 0;
const trade = (
  symbol: string,
  side: "buy" | "sell",
  date: string,
  quantity: number,
  price: number,
  fees = 0,
): Trade => ({ id: String(++next), symbol, side, date, quantity, price, fees });

// 2026-10-30 20:00 UTC: the session the quote is from.
const TS = 1793390400;
const quote = (code: string, close: number, previousClose: number) => ({
  code,
  timestamp: TS,
  close,
  previousClose,
  change: close - previousClose,
  change_p: ((close - previousClose) / previousClose) * 100,
  volume: null,
});

describe("openLots", () => {
  const fifo = [
    trade("AAPL.US", "buy", "2026-01-05", 10, 100, 5),
    trade("AAPL.US", "buy", "2026-02-02", 10, 120, 0),
    trade("AAPL.US", "sell", "2026-03-02", 15, 130, 0),
  ];

  it("sells the oldest shares first, and their fees leave with them", () => {
    expect(openLots(fifo).get("AAPL.US")).toEqual([
      { quantity: 5, price: 120, feePerShare: 0, date: "2026-02-02" },
    ]);
    const [p] = positions(fifo, []).positions;
    expect(p).toMatchObject({ symbol: "AAPL.US", quantity: 5, cost: 600, avgCost: 120 });
  });

  it("keeps half a lot's fees with the half not sold", () => {
    const half = [...fifo.slice(0, 2), trade("AAPL.US", "sell", "2026-03-02", 5, 130, 0)];
    // 5 left of the first lot at 100 + 0.50 a share in fees, and the second lot whole.
    expect(positions(half, []).positions[0]).toMatchObject({ quantity: 15, cost: 1702.5 });
  });

  it("puts a buy before a sale on the same day, whatever order they were entered in", () => {
    const sameDay = [
      trade("MSFT.US", "sell", "2026-03-02", 10, 410),
      trade("MSFT.US", "buy", "2026-03-02", 10, 400),
    ];
    expect(parseTrades(sameDay)).not.toBeNull();
    expect(openLots(sameDay).get("MSFT.US")).toEqual([]);
    expect(positions(sameDay, []).positions).toEqual([]);
  });
});

describe("dayChange", () => {
  it("moves shares held overnight from the previous close", () => {
    // 10 shares, 100 → 110: +100.
    expect(dayChange(110, 100, 10, { quantity: 0, cost: 0 })).toBe(100);
  });

  it("moves shares bought on the quote's day from what was paid", () => {
    // 10 held overnight: (110 − 100) × 10 = +100. 5 bought today at 104 with 1 in fees,
    // 104.20 a share: (110 − 104.20) × 5 = +29. Together +129, not the +150 that counting
    // all fifteen from yesterday's close would claim.
    expect(dayChange(110, 100, 15, { quantity: 5, cost: 521 })).toBeCloseTo(129, 10);
  });

  it("is worked out the same way inside positions, from the quote's own day", () => {
    const trades = [
      trade("AAPL.US", "buy", "2026-10-29", 10, 90),
      trade("AAPL.US", "buy", "2026-10-30", 5, 104, 1),
    ];
    const [p] = positions(trades, [quote("AAPL.US", 110, 100)]).positions;
    expect(p.day).toBeCloseTo(129, 10);
    expect(p.unrealised).toBeCloseTo(1650 - (900 + 521), 10);
  });

  it("is unknown without a previous close, not zero", () => {
    const [p] = positions([trade("AAPL.US", "buy", "2026-10-01", 1, 90)], [
      { code: "AAPL.US", timestamp: TS, close: 110 },
    ]).positions;
    expect(p.price).toBe(110);
    expect(p.day).toBeNull();
  });
});

describe("positions", () => {
  const trades = [
    trade("AAPL.US", "buy", "2026-03-02", 10, 200),
    trade("MSFT.US", "buy", "2026-03-02", 2, 400),
    trade("NVDA.US", "buy", "2026-03-02", 20, 100),
    trade("TSLA.US", "buy", "2026-03-02", 3, 300),
  ];
  const quotes = [
    quote("AAPL.US", 250, 248),
    quote("MSFT.US", 500, 505),
    quote("NVDA.US", 150, 145),
    { code: "TSLA.US", status: "unavailable" as const },
  ];
  const book = positions(trades, quotes);

  it("leaves a position without a price out of the totals, and says how many", () => {
    const tsla = book.positions.find((p) => p.symbol === "TSLA.US")!;
    expect(tsla).toMatchObject({ quantity: 3, cost: 900, price: null, value: null, weight: null });
    expect(book.unpriced).toBe(1);
    // 2,500 + 1,000 + 3,000: TSLA is not valued at zero, it is not valued.
    expect(book.totals.value).toBe(6500);
    expect(book.totals.cost).toBe(2000 + 800 + 2000);
    expect(book.totals.unrealised).toBe(6500 - 4800);
    expect(book.totals.day).toBeCloseTo(20 - 10 + 100, 10);
  });

  it("weighs each priced position by value, the weights summing to 1", () => {
    const weights = book.positions.flatMap((p) => (p.weight === null ? [] : [p.weight]));
    expect(weights).toHaveLength(3);
    expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);
    expect(book.positions.find((p) => p.symbol === "NVDA.US")!.weight).toBeCloseTo(3000 / 6500, 12);
  });

  it("prices a position by the quote's close alone: without one it is unpriced", () => {
    const held = [trade("AAPL.US", "buy", "2026-03-02", 1, 200)];
    const book = positions(held, [{ code: "AAPL.US", timestamp: TS, previousClose: 240 }]);
    expect(book.positions[0]).toMatchObject({ price: null, value: null, day: null });
    expect(book.unpriced).toBe(1);
    // What the cockpit hands over: a quote whose close is "NA" is already unavailable.
    const na = { code: "AAPL.US", timestamp: TS, close: "NA", previousClose: 240, change: "NA" };
    const rows = toRows({ ...na, change_p: "NA" });
    expect(rows).toEqual([{ code: "AAPL.US", status: "unavailable" }]);
    expect(positions(held, rows).unpriced).toBe(1);
  });
});

describe("parseTrades", () => {
  const ok = [trade("AAPL.US", "buy", "2026-01-05", 10, 100, 1)];

  it("accepts a list of real trades", () => {
    expect(parseTrades(ok)).toEqual(ok);
  });

  it("refuses a symbol that is not a US listing: one currency, never pence beside dollars", () => {
    const vod = [trade("VOD.LSE", "buy", "2026-01-05", 100, 74.6)];
    expect(parseTrades(vod)).toBeNull();
    expect(checkTrades(vod)).toEqual({ error: expect.stringMatching(/\.US/) });
  });

  it("refuses a quantity of zero, rather than storing a trade of nothing", () => {
    expect(parseTrades([trade("AAPL.US", "buy", "2026-01-05", 0, 100)])).toBeNull();
  });

  it("refuses to sell more than is held at that date, and names what was held", () => {
    const oversell = [...ok, trade("AAPL.US", "sell", "2026-02-01", 15, 120)];
    expect(parseTrades(oversell)).toBeNull();
    expect(checkTrades(oversell)).toEqual({ error: expect.stringMatching(/only 10 held/) });
    // A sale dated before the buy is an oversell too, however the list is ordered.
    const early = [...ok, trade("AAPL.US", "sell", "2026-01-04", 1, 99)];
    expect(checkTrades(early)).toEqual({ error: expect.stringMatching(/only 0 held/) });
  });

  it("refuses a trade whose numbers would overflow the book, and says which bound", () => {
    // 1e308 shares at $100 is Infinity in the value, and NaN once it meets a cost.
    const huge = [trade("AAPL.US", "buy", "2026-01-05", 1e308, 100)];
    expect(parseTrades(huge)).toBeNull();
    expect(checkTrades(huge)).toEqual({
      error: expect.stringMatching(/quantity can’t be more than 1,000,000,000,000\b/),
    });
    // A billion shares at two million dollars: 2e15, above the bound on one trade's value.
    expect(checkTrades([trade("AAPL.US", "buy", "2026-01-05", 1e9, 2e6)])).toEqual({
      error: expect.stringMatching(/quantity × price\) can’t be more than 1,000,000,000,000,000\b/),
    });
    expect(checkTrades([trade("AAPL.US", "buy", "2026-01-05", 1, 100, 2e15)])).toEqual({
      error: expect.stringMatching(/fees can’t be more than/),
    });
    // At the bounds themselves, a trade still passes.
    expect(parseTrades([trade("AAPL.US", "buy", "2026-01-05", 1e12, 1000, 1e15)])).not.toBeNull();
    // A layout carrying such a trade is refused whole, so the panel never draws Infinity.
    const base = MARKETS_LAYOUT.panels.find((p) => p.type === "portfolio")!;
    const config = { trades: huge, follows: false };
    const [panel] = parseLayout({ ...MARKETS_LAYOUT, panels: [{ ...base, config }] }).panels;
    expect(panel.type).toBe("placeholder");
  });

  it("refuses a date that does not exist, a repeated id, and more than 200 trades", () => {
    expect(parseTrades([trade("AAPL.US", "buy", "2026-02-30", 1, 100)])).toBeNull();
    expect(parseTrades([...ok, { ...ok[0] }])).toBeNull();
    const many = Array.from({ length: 201 }, () => trade("AAPL.US", "buy", "2026-01-05", 1, 100));
    expect(parseTrades(many)).toBeNull();
    expect(parseTrades("no")).toBeNull();
  });
});

describe("the portfolio panel", () => {
  const config = {
    trades: [
      trade("AAPL.US", "buy", "2026-03-02", 10, 200, 1),
      trade("NVDA.US", "buy", "2026-03-02", 4, 120),
      trade("NVDA.US", "sell", "2026-06-01", 4, 150),
      trade("TSLA.US", "buy", "2026-03-02", 3, 300),
    ],
    follows: false,
  };

  it("asks for quotes of the open positions only", () => {
    expect(PortfolioPanel.dataNeeds(config)).toEqual({ quotes: ["AAPL.US", "TSLA.US"] });
  });

  it("renders literal trades and quotes with no mock and no network", () => {
    const html = renderToString(
      createElement(PortfolioPanel.Component, {
        config,
        data: {
          quotes: [
            { row: quote("AAPL.US", 251.32, 248.9), fetchedAt: 0 },
            { row: { code: "TSLA.US", status: "unavailable" }, fetchedAt: 0 },
          ],
          screen: null,
          bars: null,
          sentiment: null,
          notes: {},
          selected: null,
        },
        onSelect: () => {},
        onConfigChange: () => {},
      }),
    );
    expect(html).toContain("AAPL.US");
    expect(html).toContain("2,513.20"); // 10 × 251.32
    expect(html).toContain("+512.20"); // 2,513.20 − 2,001.00
    expect(html).toContain("+24.20"); // (251.32 − 248.90) × 10
    expect(html).toContain("no price: left out of the totals");
    expect(html).toContain("Total");
    expect(html).toContain("1 position left out");
    expect(html).not.toContain("NVDA.US"); // sold out: no position
    expect(html).toContain("Add trade");
  });
});

describe("the Markets layout", () => {
  it("holds a few example trades, a sale among them, on symbols the fixtures can price", () => {
    const panel = MARKETS_LAYOUT.panels.find((p) => p.type === "portfolio");
    const trades = (panel?.config as { trades: Trade[] }).trades;
    expect(trades.some((t) => t.side === "sell")).toBe(true);
    const priced = new Set(
      (JSON.parse(readFileSync("fixtures/real-time.json", "utf8")) as { code: string }[]).map((r) => r.code),
    );
    for (const t of trades) expect(priced.has(t.symbol)).toBe(true);
    expect(parseLayout(MARKETS_LAYOUT)).toEqual(MARKETS_LAYOUT);
  });

  it("costs 18 calls a load live, worked out from the requests the cockpit sends", () => {
    const defs = { heatmap: HeatmapPanel, quote: QuotePanel, sentiment: SentimentPanel, portfolio: PortfolioPanel };
    const needs: Needs[] = MARKETS_LAYOUT.panels.map((p) =>
      (defs[p.type as keyof typeof defs].dataNeeds as (c: unknown) => Needs)(p.config),
    );
    const quotes = quotesRequest(unionNeeds(needs))!;
    const screens = new Map(needs.flatMap((n) => (n.screen ? [[screenKey(n.screen), n.screen]] : [])));
    const calls = {
      quotes: estimateCalls(quotes.path, quotes.params),
      screens: [...screens.values()].reduce(
        (sum, s) => sum + screenCalls({ filters: toTriples(s.filters), sort: s.sort, limit: PAGE_LIMIT }),
        0,
      ),
      sentiment: estimateCalls("sentiments", { s: sentimentKey(needs) }),
    };
    // NVDA.US, AAPL.US, MSFT.US: the quote panel starts on a symbol the portfolio holds.
    expect(calls).toEqual({ quotes: 3, screens: 5, sentiment: 10 });
  });

  it("refuses a portfolio panel whose trades do not pass their check", () => {
    const base = MARKETS_LAYOUT.panels.find((p) => p.type === "portfolio")!;
    const bad = { trades: [trade("VOD.LSE", "buy", "2026-01-05", 1, 1)], follows: false };
    const [panel] = parseLayout({ ...MARKETS_LAYOUT, panels: [{ ...base, config: bad }] }).panels;
    expect(panel.type).toBe("placeholder");
  });
});
