import { describe, expect, it } from "vitest";
import { createMarketStore, createRequestCache, oldestTimestamp } from "@/lib/market-store";
import type { Row } from "@/lib/rows";

const quote = (code: string, timestamp = 1793390400): Row => ({
  code,
  timestamp,
  close: 100,
  previousClose: 99,
  change: 1,
  change_p: 1.01,
  volume: 1000,
});

/** A fetcher that counts its calls and the symbols it was asked for. */
function fakeFetcher() {
  const calls: string[][] = [];
  const fetchQuotes = async (symbols: string[]) => {
    calls.push([...symbols]);
    return symbols.map((s) => quote(s));
  };
  return { calls, fetchQuotes };
}

describe("the market store", () => {
  it("makes one request for the union when two callers ask in the same tick", async () => {
    const f = fakeFetcher();
    const store = createMarketStore(f.fetchQuotes, () => 0, 60_000);
    const [a, b] = await Promise.all([
      store.quotes(["AAPL.US", "MSFT.US"]),
      store.quotes(["MSFT.US", "NVDA.US"]),
    ]);
    expect(f.calls).toHaveLength(1);
    expect([...f.calls[0]].sort()).toEqual(["AAPL.US", "MSFT.US", "NVDA.US"]);
    expect(a.map((x) => x.row.code)).toEqual(["AAPL.US", "MSFT.US"]);
    expect(b.map((x) => x.row.code)).toEqual(["MSFT.US", "NVDA.US"]);
  });

  it("makes none when asked again inside maxAge, and one after it", async () => {
    const f = fakeFetcher();
    let now = 0;
    const store = createMarketStore(f.fetchQuotes, () => now, 60_000);
    await store.quotes(["AAPL.US"]);
    now = 59_999;
    const again = await store.quotes(["AAPL.US"]);
    expect(f.calls).toHaveLength(1);
    expect(again[0].fetchedAt).toBe(0); // every row says when it was fetched
    now = 60_000;
    await store.quotes(["AAPL.US"]);
    expect(f.calls).toHaveLength(2);
  });

  it("gives a second caller the request already in flight", async () => {
    let release: () => void = () => {};
    let calls = 0;
    const store = createMarketStore(
      (symbols) =>
        new Promise((resolve) => {
          calls++;
          release = () => resolve(symbols.map((s) => quote(s)));
        }),
      () => 0,
      60_000,
    );
    const first = store.quotes(["AAPL.US"]);
    await Promise.resolve(); // the first request has left
    await Promise.resolve();
    const second = store.quotes(["AAPL.US"]);
    release();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });
});

describe("oldestTimestamp", () => {
  it("is the stalest row, because a page is only as current as that", () => {
    expect(
      oldestTimestamp([quote("A", 1787689680), quote("B", 1787689740), { code: "C", status: "unavailable" }]),
    ).toBe(1787689680);
    expect(oldestTimestamp([])).toBeNull();
  });
});

describe("the request cache", () => {
  it("asks once for a key, shares the request in flight, and keeps the answer for maxAge", async () => {
    let calls = 0;
    let now = 0;
    const cache = createRequestCache(async (key) => {
      calls++;
      return key.toUpperCase();
    }, () => now, 60_000);
    const [a, b] = await Promise.all([cache.get("screen"), cache.get("screen")]);
    expect(calls).toBe(1);
    expect(a).toEqual({ value: "SCREEN", fetchedAt: 0 });
    expect(b).toBe(a);
    now = 30_000;
    await cache.get("screen");
    expect(calls).toBe(1);
    now = 60_000;
    await cache.get("screen");
    expect(calls).toBe(2);
  });
});

