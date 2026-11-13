import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/proxy/[...path]/route";
import { SentimentPanel } from "@/components/panels/SentimentPanel";
import { estimateCalls } from "@/lib/cost";
import { MARKETS_LAYOUT, parseLayout } from "@/lib/layout";
import { neededBy, sentimentKey, symbolsOf, unionNeeds } from "@/lib/panels";
import { fromAddress } from "@/lib/selection";
import {
  articles,
  MIN_ARTICLES,
  parseSentiments,
  readings,
  type SentimentDay,
  tone,
  trend,
} from "@/lib/sentiment";

const FIXTURE = JSON.parse(readFileSync("fixtures/sentiments.json", "utf8"));

const day = (date: string, count: number, normalized: number | null): SentimentDay => ({
  date,
  count,
  normalized,
});

describe("tone", () => {
  it("is the mean of normalized, weighted by the day's article count", () => {
    expect(tone([day("2026-11-13", 3, 0.5), day("2026-11-12", 1, -0.5)])).toBe(0.25);
  });

  it("weighs a day with a count of 0 as 1, not as nothing", () => {
    expect(tone([day("2026-11-13", 0, 1), day("2026-11-12", 1, 0)])).toBe(0.5);
  });

  it("skips a day whose normalized is not a number, and is null when nothing is left", () => {
    expect(tone([day("2026-11-13", 5, null), day("2026-11-12", 1, 0.4)])).toBe(0.4);
    expect(tone([day("2026-11-13", 5, Number.NaN)])).toBeNull();
    expect(tone([])).toBeNull();
  });
});

describe("trend", () => {
  // Newest first: the first half is the recent one.
  const four = (recent: number) => [
    day("2026-11-13", 10, recent),
    day("2026-11-12", 10, recent),
    day("2026-11-11", 10, 0.5),
    day("2026-11-10", 10, 0.5),
  ];

  it("compares the recent half with the older one, with 0.05 either way as flat", () => {
    expect(trend(four(0.56))).toBe("up");
    expect(trend(four(0.54))).toBe("flat");
    expect(trend(four(0.46))).toBe("flat");
    expect(trend(four(0.44))).toBe("down");
  });

  it("reads a difference of exactly 0.05 as flat, however floating point computes it", () => {
    // 0.55 − 0.50 is 0.050000000000000044, and 0.60 − 0.65 is −0.050000000000000044.
    expect(trend(four(0.55))).toBe("flat");
    const pair = (recent: number, older: number) => [
      day("2026-11-13", 10, recent),
      day("2026-11-12", 10, older),
    ];
    expect(trend(pair(0.6, 0.65))).toBe("flat");
    expect(trend(pair(0.6, 0.6500001))).toBe("down");
  });

  it("splits at floor(n/2): of three days, one is recent", () => {
    expect(
      trend([day("2026-11-13", 1, 0.9), day("2026-11-12", 1, 0.5), day("2026-11-11", 1, 0.5)]),
    ).toBe("up");
  });

  it("is flat with fewer than two days, or a half with no tone", () => {
    expect(trend([day("2026-11-13", 50, 0.9)])).toBe("flat");
    expect(trend([day("2026-11-13", 5, null), day("2026-11-12", 5, 0.1)])).toBe("flat");
  });
});

describe("parseSentiments", () => {
  it("reads nothing at all from the empty array the API sends when no symbol has news", () => {
    expect(parseSentiments([])).toEqual({});
    expect(parseSentiments(null)).toEqual({});
  });

  it("drops a day without a date, and keeps one without a tone for its count", () => {
    const parsed = parseSentiments({
      "AAPL.US": [
        { date: "2026-11-13", count: 4, normalized: "NA" },
        { count: 9, normalized: 0.7 },
        { date: "2026-11-12", count: 2, normalized: 0.6 },
      ],
    });
    expect(parsed["AAPL.US"].map((d) => d.date)).toEqual(["2026-11-13", "2026-11-12"]);
    expect(articles(parsed["AAPL.US"])).toBe(6);
    expect(tone(parsed["AAPL.US"])).toBe(0.6);
  });

  it("ignores a key that is not a symbol", () => {
    // JSON.parse makes __proto__ an own key, which a plain assignment would turn into a prototype.
    const body = JSON.parse('{"__proto__": [], "../user": [{"date": "2026-11-13", "count": 1}]}');
    expect(Object.keys(parseSentiments(body))).toEqual([]);
  });
});

describe("readings", () => {
  it("calls VOD.LSE, with 8 articles in the fixture, too few to read", () => {
    const [vod] = readings(parseSentiments(FIXTURE), ["VOD.LSE"]);
    expect(vod).toMatchObject({ symbol: "VOD.LSE", status: "too-few", articles: 8, days: 7, tone: null });
    expect(vod.articles).toBeLessThan(MIN_ARTICLES);
  });

  it("gives one entry per asked symbol: highest tone first, then too few, then none", () => {
    const parsed = parseSentiments(FIXTURE);
    const all = readings(parsed, ["ZZZ.US", "VOD.LSE", "NVDA.US", "AAPL.US", "MSFT.US"]);
    expect(all.map((r) => r.symbol)).toEqual(["MSFT.US", "AAPL.US", "NVDA.US", "VOD.LSE", "ZZZ.US"]);
    expect(all.map((r) => r.status)).toEqual(["ok", "ok", "ok", "too-few", "none"]);
    expect(all[0]).toMatchObject({ days: 31, from: "2026-10-14", to: "2026-11-13" });
    expect(all[0].tone).toBeGreaterThan(all[1].tone!);
    expect(all.at(-1)).toMatchObject({ articles: 0, days: 0, tone: null, from: null, to: null });
    // Without the floor, eight articles would put VOD.LSE at the top of the list.
    expect(tone(parsed["VOD.LSE"])).toBeGreaterThan(all[0].tone!);
  });
});

describe("the price", () => {
  it("is five calls per symbol", () => {
    expect(estimateCalls("sentiments", { s: "AAPL.US" })).toBe(5);
    expect(estimateCalls("sentiments", { s: "AAPL.US,MSFT.US" })).toBe(10);
  });

  it("is paid once for every visible panel's symbols together, sorted", () => {
    expect(
      sentimentKey([
        { quotes: [], sentiment: ["MSFT.US", "AAPL.US"] },
        { quotes: ["SPY.US"] },
        { quotes: [], sentiment: ["NVDA.US", "AAPL.US"] },
      ]),
    ).toBe("AAPL.US,MSFT.US,NVDA.US");
    expect(sentimentKey([{ quotes: ["SPY.US"] }])).toBe("");
  });

  it("leaves a collapsed sentiment panel out of the one request, so it costs nothing", () => {
    const panels = [
      { collapsed: false, needs: { quotes: [], sentiment: ["AAPL.US"] } },
      { collapsed: true, needs: { quotes: [], sentiment: ["MSFT.US", "NVDA.US"] } },
    ];
    const key = sentimentKey(neededBy(panels, (p) => p.needs));
    expect(key).toBe("AAPL.US");
    expect(estimateCalls("sentiments", { s: key })).toBe(5);
    expect(sentimentKey(neededBy([panels[1]], (p) => p.needs))).toBe("");
  });
});

/** Call the route the way Next.js does: path segments already decoded. */
function call(pathAndQuery: string) {
  const url = new URL(`http://localhost/api/proxy/${pathAndQuery}`);
  const path = url.pathname.replace(/^\/api\/proxy\//, "").split("/");
  return GET(new NextRequest(url), { params: Promise.resolve({ path }) });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the proxy", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
  });

  it("forwards sentiments and says what it cost", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      void input;
      return new Response("[]", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("sentiments?s=AAPL.US,MSFT.US");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-eodhd-calls")).toBe("10");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/sentiments");
    expect(url.searchParams.get("s")).toBe("AAPL.US,MSFT.US");
  });

  it("still refuses an endpoint that is not listed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call("sentiment?s=AAPL.US");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/sentiments/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mock mode", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_MOCK", "1");
    vi.stubEnv("EODHD_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("mock mode must not touch the network");
      }),
    );
  });

  it("answers only the asked symbols, keyed by symbol, and omits one it has nothing for", async () => {
    const body = await (await call("sentiments?s=AAPL.US,ZZZ.US,VOD.LSE")).json();
    expect(Object.keys(body)).toEqual(["AAPL.US", "VOD.LSE"]);
    expect(body["AAPL.US"]).toEqual(FIXTURE["AAPL.US"]);
  });

  it("answers [] when it has none of them, as the API does", async () => {
    const res = await call("sentiments?s=ZZZ.US");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("narrows to from and to", async () => {
    const body = await (await call("sentiments?s=AAPL.US&from=2026-11-12&to=2026-11-13")).json();
    expect(body["AAPL.US"].map((d: SentimentDay) => d.date)).toEqual(["2026-11-13", "2026-11-12"]);
  });
});

describe("the sentiment panel", () => {
  it("renders literal days with no mock and no network", () => {
    const html = renderToString(
      createElement(SentimentPanel.Component, {
        config: { symbols: ["AAPL.US", "VOD.LSE", "ZZZ.US"], follows: false },
        data: {
          quotes: [],
          screen: null,
          bars: null,
          sentiment: {
            bySymbol: {
              "AAPL.US": [
                day("2026-11-13", 30, 0.8),
                day("2026-11-12", 10, 0.4),
                day("2026-11-11", 10, 0.6),
              ],
              "VOD.LSE": [day("2026-11-11", 1, 0.993), day("2026-11-10", 7, 0.1)],
            },
            fetchedAt: 0,
          },
          notes: {},
          selected: null,
        },
        onSelect: () => {},
        onConfigChange: () => {},
      }),
    );
    expect(html).toContain("AAPL.US");
    expect(html).toContain("+0.68"); // (30×0.8 + 10×0.4 + 10×0.6) / 50
    expect(html).toContain("↑ up");
    expect(html).toContain("8 articles: too few to read");
    expect(html).toContain("No news");
    expect(html).toContain("article-weighted mean of EODHD’s daily news tone, −1 to 1, 2026-11-10 to 2026-11-13");
  });

  it("asks for its symbols' sentiment and no quotes", () => {
    expect(SentimentPanel.dataNeeds({ symbols: ["AAPL.US"], follows: false })).toEqual({
      quotes: [],
      sentiment: ["AAPL.US"],
    });
  });
});

describe("the address", () => {
  it("may select a symbol that only the sentiment panel shows", () => {
    const needs = [{ quotes: ["SPY.US"] }, { quotes: [], sentiment: ["MSFT.US"] }];
    expect(unionNeeds(needs)).not.toContain("MSFT.US"); // quotes alone would refuse it
    expect(fromAddress("MSFT.US", symbolsOf(needs))).toBe("MSFT.US");
    expect(fromAddress("NVDA.US", symbolsOf(needs))).toBeNull();
  });
});

describe("the Markets layout", () => {
  it("reads the news tone of two symbols, pinned", () => {
    const panel = MARKETS_LAYOUT.panels.find((p) => p.type === "sentiment");
    expect(panel?.config).toEqual({ symbols: ["AAPL.US", "MSFT.US"], follows: false });
    expect(parseLayout(MARKETS_LAYOUT)).toEqual(MARKETS_LAYOUT);
  });

  it("refuses a sentiment panel with no symbols, more than five, or one that is not a symbol", () => {
    const base = MARKETS_LAYOUT.panels.find((p) => p.type === "sentiment")!;
    const configs = [
      { symbols: [], follows: false },
      { symbols: ["A.US", "B.US", "C.US", "D.US", "E.US", "F.US"], follows: false },
      { symbols: ["../user"], follows: false },
      { symbols: ["AAPL.US", "AAPL.US"], follows: false },
    ];
    for (const config of configs) {
      const [panel] = parseLayout({ ...MARKETS_LAYOUT, panels: [{ ...base, config }] }).panels;
      expect(panel.type).toBe("placeholder");
    }
  });
});
