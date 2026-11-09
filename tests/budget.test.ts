import { afterEach, describe, expect, it, vi } from "vitest";
import { BacktestPanel } from "@/components/panels/BacktestPanel";
import { QuotePanel } from "@/components/panels/QuotePanel";
import { ScreenPanel } from "@/components/panels/ScreenPanel";
import { WatchlistPanel } from "@/components/panels/WatchlistPanel";
import {
  askWithinLimits,
  callsPerMinute,
  exhaustsAt,
  marketOpen,
  pausedLine,
  refreshCost,
  shouldRefresh,
} from "@/lib/budget";
import { DEFAULT_SORT } from "@/lib/filters";
import { DEFAULT_LAYOUT, type Panel } from "@/lib/layout";
import type { Needs } from "@/lib/panels";
import { failureOf, fetchPlan, quotesViaProxy, requestsOf, without } from "@/lib/proxy-fetch";
import { RULES } from "@/lib/rules";
import { MY_FILTERS } from "@/lib/screen-query";

// The lesson's worked cockpit: twelve live quotes, one screen, a quote panel on one of the
// twelve, and a daily chart.
const twelve = [
  "AAPL.US", "MSFT.US", "NVDA.US", "AMZN.US", "GOOGL.US", "META.US",
  "TSLA.US", "BRK-B.US", "JPM.US", "V.US", "XOM.US", "SPY.US",
];
const watchlist: Needs = { quotes: twelve };
const screen: Needs = { quotes: [], screen: { filters: MY_FILTERS, sort: DEFAULT_SORT, follows: false } };
const quote: Needs = { quotes: ["AAPL.US"] };
const chart: Needs = { quotes: [], eod: "SPY.US" };

describe("refreshCost", () => {
  it("prices the worked cockpit at 18 a refresh, the quote panel adding nothing", () => {
    expect(refreshCost(requestsOf(fetchPlan([watchlist, screen, quote, chart])))).toBe(18);
    expect(refreshCost(requestsOf(fetchPlan([watchlist, screen, chart])))).toBe(18);
  });

  it("is 19 when each panel fetches for itself: the union is the saving", () => {
    const each = [watchlist, screen, quote, chart].map((n) => refreshCost(requestsOf(fetchPlan([n]))));
    expect(each).toEqual([12, 5, 1, 1]);
    expect(each.reduce((a, b) => a! + b!, 0)).toBe(19);
  });

  it("is null, not zero, when a request is not in the cost table", () => {
    expect(refreshCost([{ path: "eod/AAPL.US", params: {} }, { path: "bulk-fundamentals/US", params: {} }])).toBeNull();
  });

  it("prices this cockpit's default layout from the panels' own needs", () => {
    const defs = { watchlist: WatchlistPanel, screen: ScreenPanel, quote: QuotePanel, backtest: BacktestPanel };
    const needs = DEFAULT_LAYOUT.panels.map((p: Panel) =>
      (defs[p.type as keyof typeof defs] as { dataNeeds(c: unknown): Needs }).dataNeeds(p.config),
    );
    const rules = RULES.filter((r) => r.enabled).map((r) => r.ticker);
    // 7 watchlist symbols (the quote panel's and the rule's among them), a screen, SPY's history.
    expect(refreshCost(requestsOf(fetchPlan(needs, rules)))).toBe(7 + 5 + 1);
  });
});

describe("the projection", () => {
  it("says when the allowance runs out at this rate", () => {
    // 340 of 1,000 used at 11:20 UTC, 18 a refresh every five minutes: 36 more refreshes.
    const at = exhaustsAt(1000 - 340, 18, 5 * 60_000, Date.UTC(2026, 10, 6, 11, 20));
    expect(at?.toISOString()).toBe("2026-11-06T14:20:00.000Z");
  });

  it("is a day's arithmetic: 78 refreshes in 6.5 hours at 18 is 1,404 calls", () => {
    expect(callsPerMinute([{ cost: 18, everyMs: 5 * 60_000 }]) * 6.5 * 60).toBeCloseTo(1404);
  });

  it("has no time when nothing refreshes by itself", () => {
    expect(exhaustsAt(20, 0, 60_000, 0)).toBeNull();
  });

  it("prices a shared symbol in the faster round only", () => {
    const live = fetchPlan([watchlist]);
    const slow = without(fetchPlan([quote, screen]), live);
    expect(requestsOf(slow).map((r) => r.path)).toEqual(["screener"]);
    expect(
      callsPerMinute([
        { cost: refreshCost(requestsOf(live))!, everyMs: 60_000 },
        { cost: refreshCost(requestsOf(slow))!, everyMs: 15 * 60_000 },
      ]),
    ).toBeCloseTo(12 + 5 / 15);
  });
});

describe("marketOpen", () => {
  it("knows the US session in New York time, and the weekend", () => {
    expect(marketOpen("AAPL.US", Date.UTC(2026, 10, 6, 15, 0))).toBe(true); // Fri 10:00 New York
    expect(marketOpen("AAPL.US", Date.UTC(2026, 10, 6, 21, 30))).toBe(false); // Fri 16:30
    expect(marketOpen("AAPL.US", Date.UTC(2026, 10, 7, 15, 0))).toBe(false); // Saturday
  });

  it("keeps crypto open, and an exchange it does not know counts as open", () => {
    expect(marketOpen("BTC-USD.CC", Date.UTC(2026, 10, 7, 3, 0))).toBe(true);
    expect(marketOpen("SAP.XETRA", Date.UTC(2026, 10, 7, 3, 0))).toBe(true);
  });
});

describe("shouldRefresh", () => {
  const at = { limit: 20, perRefresh: 7, reserve: 13 };

  it("stops the loop once the calls left would not cover a refresh plus the reserve", () => {
    expect(shouldRefresh({ ...at, used: 0, byHand: false })).toBe(true); // 20 >= 7 + 13
    expect(shouldRefresh({ ...at, used: 1, byHand: false })).toBe(false); // 19 left
  });

  it("lets a refresh by hand spend the reserve, and nothing past the limit", () => {
    expect(shouldRefresh({ ...at, used: 1, byHand: true })).toBe(true);
    expect(shouldRefresh({ ...at, used: 13, byHand: true })).toBe(true); // 7 left, 7 needed
    expect(shouldRefresh({ ...at, used: 14, byHand: true })).toBe(false);
  });
});

describe("pausedLine", () => {
  it("names the count, the limit and the reset, and nothing went wrong", () => {
    expect(pausedLine({ used: 20, limit: 20 })).toBe(
      "Refresh paused: 20 of 20 calls used today, resets at 00:00 UTC.",
    );
    expect(pausedLine(null)).toBe("Refresh paused: today’s calls are used up, resets at 00:00 UTC.");
  });
});

describe("at the wall", () => {
  afterEach(() => vi.unstubAllGlobals());
  const answer = (status: number, headers: Record<string, string> = {}, body = "") =>
    new Response(body, { status, headers });

  it("a 402 is never retried: one request, and the failure is the spent day", async () => {
    const fetcher = vi.fn(async () => answer(402, {}, "Payment required"));
    vi.stubGlobal("fetch", fetcher);
    const error = await quotesViaProxy(["AAPL.US", "MSFT.US"]).catch((e: unknown) => e);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(failureOf(error)).toEqual({ kind: "quota" });
  });

  it("a 429 waits for Retry-After, then asks once more", async () => {
    const waits: number[] = [];
    const send = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(answer(429, { "retry-after": "3" }))
      .mockResolvedValueOnce(answer(200, {}, "[]"));
    const res = await askWithinLimits(send, async (ms) => void waits.push(ms));
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([3000]);
  });

  it("waits the whole minute when Retry-After is missing", async () => {
    const waits: number[] = [];
    const send = vi.fn(async () => answer(429));
    await askWithinLimits(send, async (ms) => void waits.push(ms));
    expect(waits).toEqual([60_000]);
  });

  it("a second 429 is handed back, not chased", async () => {
    const send = vi.fn(async () => answer(429, { "retry-after": "1" }));
    const res = await askWithinLimits(send, async () => {});
    expect(res.status).toBe(429);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
