import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCandles, toBars } from "@/lib/backtest/candles";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loading candles", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
  });

  it("surfaces a plain-text 404 instead of choking on it as JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("Ticker Not Found.", {
            status: 404,
            headers: { "content-type": "text/plain" },
          }),
      ),
    );
    expect(await loadCandles("APPL.USS", { from: "2026-01-01" })).toEqual({
      notFound: "Ticker Not Found.",
    });
  });

  it("reads a year of SPY from the fixture in mock mode, oldest first", async () => {
    vi.stubEnv("EODHD_MOCK", "1");
    vi.stubEnv("EODHD_API_KEY", "");
    const result = await loadCandles("SPY.US");
    if (!("bars" in result)) throw new Error("expected bars");
    expect(result.bars).toHaveLength(251);
    expect(result.bars[0].date).toBe("2025-10-31");
    expect(result.bars.at(-1)).toMatchObject({ date: "2026-10-30", close: 668.2 });
  });
});

describe("toBars", () => {
  const bar = (date: string) => ({
    date,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
    adjusted_close: 1,
    volume: 1,
  });

  it("refuses a series that runs newest-first, loudly", () => {
    expect(() => toBars([bar("2026-10-30"), bar("2026-10-29")])).toThrow(
      "bars must be oldest-first",
    );
  });

  it("drops rows without the fields a bar needs", () => {
    expect(toBars([bar("2026-10-29"), { date: "2026-10-30", close: 1 }])).toHaveLength(1);
  });
});
