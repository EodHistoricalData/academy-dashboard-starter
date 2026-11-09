import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMarketStore } from "@/lib/market-store";
import { admit, kindOf, STOP_AT } from "@/lib/quota-policy";
import type { Row } from "@/lib/rows";

const count = vi.hoisted(() => ({ used: 0 as number | null, limit: 20 as number | null }));
vi.mock("@/lib/usage", () => ({ todayCount: async () => ({ ...count }) }));
const { GET } = await import("@/app/api/proxy/[...path]/route");

describe("admit: the allowance gives way in a written order", () => {
  it("walks the count from empty to the limit: background first, a refresh by hand last", () => {
    const lastAdmitted = Object.fromEntries(
      (Object.keys(STOP_AT) as (keyof typeof STOP_AT)[]).map((kind) => {
        let last = -1;
        for (let used = 0; used <= 20; used++) if (admit(kind, used, 20)) last = used;
        return [kind, last];
      }),
    );
    expect(lastAdmitted).toEqual({ background: 9, auto: 14, alert: 17, manual: 19 });
    // At 19 of 20 only a refresh someone pressed is still served.
    expect(admit("auto", 19, 20)).toBe(false);
    expect(admit("manual", 19, 20)).toBe(true);
    expect(admit("manual", 20, 20)).toBe(false);
  });

  it("admits only a refresh by hand when the count cannot be read", () => {
    expect(admit("background", null, 20)).toBe(false);
    expect(admit("auto", 3, null)).toBe(false);
    expect(admit("manual", null, null)).toBe(true);
  });

  it("treats a missing or unknown marker as background", () => {
    expect(kindOf(null)).toBe("background");
    expect(kindOf("urgent")).toBe("background");
    expect(kindOf("toString")).toBe("background");
    expect(kindOf("manual")).toBe("manual");
  });
});

describe("the proxy, at 16 of 20", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]")));
    count.used = 16;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  let n = 0;
  const call = (budget?: string) => {
    const headers: Record<string, string> = { "x-forwarded-for": `203.0.113.${++n}` };
    if (budget) headers["x-budget"] = budget;
    return GET(new NextRequest("http://localhost/api/proxy/eod/AAPL.US", { headers }), {
      params: Promise.resolve({ path: ["eod", "AAPL.US"] }),
    });
  };

  it("refuses a request with no marker as background, naming the stage", async () => {
    const res = await call();
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ stage: "background", error: expect.stringMatching(/16 of 20.*50%/) });
  });

  it("refuses a panel's timer, and serves a refresh someone pressed", async () => {
    const timer = await call("auto");
    expect(timer.status).toBe(402);
    expect((await timer.json()).error).toMatch(/timer.*75%/);
    expect((await call("manual")).status).toBe(200);
  });
});

describe("the market store passes the marker on", () => {
  it("sends one batch with the most urgent kind among the callers in the tick", async () => {
    const kinds: string[] = [];
    const store = createMarketStore(
      async (symbols: string[], kind) => {
        kinds.push(kind);
        return symbols.map((code) => ({ code, status: "unavailable" }) as Row);
      },
      () => 0,
      60_000,
    );
    await Promise.all([store.quotes(["AAPL.US"], false, "auto"), store.quotes(["MSFT.US"], true, "manual")]);
    expect(kinds).toEqual(["manual"]);
  });
});
