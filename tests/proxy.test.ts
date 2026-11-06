import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/proxy/[...path]/route";
import { quotes } from "@/lib/quotes";
import { WATCHLIST } from "@/lib/watchlist";

// Not a key, and not shaped like one: the key scan in CI would refuse the file otherwise.
const FAKE_KEY = "test-key-not-a-real-one";

/** Call the route the way Next.js does: path segments already decoded. */
function call(pathAndQuery: string, segments?: string[]) {
  const url = new URL(`http://localhost/api/proxy/${pathAndQuery}`);
  const path =
    segments ??
    url.pathname.replace(/^\/api\/proxy\//, "").split("/").map(decodeURIComponent);
  return GET(new NextRequest(url), { params: Promise.resolve({ path }) });
}

function upstream(body: string, init: ResponseInit = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    void input;
    return new Response(body, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof upstream>): URL {
  return new URL(String(fetchMock.mock.calls[0][0]));
}

beforeEach(() => {
  vi.stubEnv("EODHD_API_KEY", FAKE_KEY);
  vi.stubEnv("EODHD_MOCK", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("allowlist", () => {
  it("refuses /user, and says why", async () => {
    const fetchMock = upstream("{}");
    const res = await call("user");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/e-mail address/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an endpoint it does not know, and lists the ones it does", async () => {
    const fetchMock = upstream("{}");
    const res = await call("bulk-fundamentals/US");
    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error).toMatch(/does not forward \/bulk-fundamentals/);
    expect(error).toMatch(/eod, real-time/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a path that would climb out of an allowed endpoint", async () => {
    const fetchMock = upstream("{}");
    // What /api/proxy/eod/%2e%2e/user arrives as once the router has decoded it.
    const res = await call("eod/x/user", ["eod", "..", "user"]);
    expect(res.status).toBe(404);
    const encoded = await call("eod/x", ["eod", "../user"]);
    expect(encoded.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an allowed endpoint", async () => {
    const fetchMock = upstream("[]", { status: 200 });
    const res = await call("eod/AAPL.US?period=d");
    expect(res.status).toBe(200);
    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/eod/AAPL.US");
    expect(url.searchParams.get("period")).toBe("d");
  });
});

describe("the key", () => {
  it("drops an api_token the caller supplies, in any case", async () => {
    const fetchMock = upstream("[]", { status: 200 });
    await call("eod/AAPL.US?api_token=someone-elses&API_TOKEN=another&period=d");
    const url = requestedUrl(fetchMock);
    expect(url.searchParams.getAll("api_token")).toEqual([FAKE_KEY]);
    expect(url.searchParams.has("API_TOKEN")).toBe(false);
    expect(url.searchParams.get("period")).toBe("d");
  });

  it("is cut out of an upstream error body that echoes the request", async () => {
    upstream(
      `Unauthenticated: https://eodhd.com/api/eod/AAPL.US?api_token=${FAKE_KEY}&fmt=json (key ${FAKE_KEY})`,
      { status: 401, headers: { "content-type": "text/plain" } },
    );
    const res = await call("eod/AAPL.US");
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain(FAKE_KEY);
    expect(body).toContain("api_token=[redacted]");
  });
});

describe("upstream status", () => {
  it("passes a 403 through with its body", async () => {
    upstream("Forbidden. Please contact support@eodhistoricaldata.com", {
      status: 403,
      headers: { "content-type": "text/plain" },
    });
    const res = await call("fundamentals/AAPL.US");
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/^Forbidden/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers a 429 with Retry-After and a sentence", async () => {
    upstream("Too Many Requests", { status: 429, headers: { "retry-after": "120" } });
    const res = await call("eod/AAPL.US");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("120");
    const { error } = await res.json();
    expect(error).toMatch(/in one minute/);
    expect(error).toMatch(/120 seconds/);
  });

  it("tells a spent day (402) apart from a busy minute (429)", async () => {
    upstream("Payment Required", { status: 402 });
    const res = await call("eod/AAPL.US");
    expect(res.status).toBe(402);
    expect(res.headers.get("retry-after")).toBeNull();
    const { error } = await res.json();
    expect(error).toMatch(/today's API calls/);
    expect(error).toMatch(/midnight GMT/);
  });

  it("supplies a Retry-After when the 429 came without one", async () => {
    upstream("Too Many Requests", { status: 429 });
    const res = await call("eod/MSFT.US");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("reports what the request cost", async () => {
    upstream("[]", { status: 200 });
    const res = await call("real-time/AAPL.US?s=MSFT.US,NVDA.US");
    expect(res.headers.get("x-eodhd-calls")).toBe("3");
  });
});

describe("the screener's input", () => {
  const filters = (triples: unknown) =>
    `screener?filters=${encodeURIComponent(JSON.stringify(triples))}`;

  it("refuses a field that is not on the list, without asking upstream", async () => {
    const fetchMock = upstream('{"data":[]}');
    const res = await call(filters([["password", "=", "x"]]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Filter 1 is not one this screener allows/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an operator that is not on the list", async () => {
    const fetchMock = upstream('{"data":[]}');
    const res = await call(filters([["market_capitalization", "LIKE", 1]]));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clamps limit=100000 to 100 before it goes upstream", async () => {
    const fetchMock = upstream('{"data":[]}');
    const res = await call(
      `${filters([["market_capitalization", ">", 1e9]])}&limit=100000`,
    );
    expect(res.status).toBe(200);
    expect(requestedUrl(fetchMock).searchParams.get("limit")).toBe("100");
  });

  it("forwards only the query it built: checked filters, the universe, sort, limit", async () => {
    const fetchMock = upstream('{"data":[]}');
    await call(
      `${filters([["earnings_share", ">", 0]])}&signals=x&offset=900&api_token=fake`,
    );
    const sent = requestedUrl(fetchMock).searchParams;
    expect(JSON.parse(sent.get("filters")!)).toEqual([
      ["earnings_share", ">", 0],
      ["exchange", "=", "us"],
    ]);
    expect(sent.get("sort")).toBe("market_capitalization.desc");
    expect(sent.get("limit")).toBe("25");
    expect(sent.has("signals")).toBe(false);
    expect(sent.has("offset")).toBe(false);
    expect(sent.get("api_token")).toBe(FAKE_KEY);
  });
});

describe("the screener's answer", () => {
  it("returns only the fields the table needs, not the upstream body as it came", async () => {
    upstream(
      JSON.stringify({
        data: [
          {
            code: "NVDA",
            name: "NVIDIA Corporation",
            last_day_data_date: "2026-10-30",
            adjusted_close: 186.75,
            market_capitalization: 4551000000000,
            email: "someone@example.com",
          },
        ],
        account: { email: "someone@example.com" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const res = await call("screener");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("someone@example.com");
    expect(JSON.parse(text).data[0]).toMatchObject({ code: "NVDA" });
  });

  it("says the key is missing, rather than that EODHD could not be reached", async () => {
    vi.stubEnv("EODHD_API_KEY", "");
    const fetchMock = upstream("{}");
    const res = await call("screener");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/EODHD_API_KEY is not set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("coalescing", () => {
  it("sends identical concurrent requests upstream once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const fetchMock = vi.fn(async () => {
      await gate;
      return new Response('{"ok":true}', { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = call("eod/AAPL.US?period=d&from=2026-01-01");
    // Same request, parameters in another order.
    const second = call("eod/AAPL.US?from=2026-01-01&period=d");
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await a.text()).toBe('{"ok":true}');
    expect(await b.text()).toBe('{"ok":true}');

    // Settled requests are not a cache: the next one goes upstream again.
    await call("eod/AAPL.US?period=d&from=2026-01-01");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("mock mode", () => {
  const fixture = (name: string) =>
    JSON.parse(readFileSync(`fixtures/${name}`, "utf8"));

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

  it("serves real-time quotes from fixtures, without a key or the network", async () => {
    const res = await call("real-time/AAPL.US?s=MSFT.US");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-eodhd-mock")).toBe("1");
    expect(res.headers.get("x-eodhd-calls")).toBe("0");
    const rows = await res.json();
    const all = fixture("real-time.json");
    expect(rows).toEqual([all[0], all[1]]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the API's shape: one ticker is an object, an unknown one is all NA", async () => {
    const one = await (await call("real-time/AAPL.US")).json();
    expect(Array.isArray(one)).toBe(false);
    expect(one.code).toBe("AAPL.US");

    const [, unknown] = await (await call("real-time/AAPL.US?s=NOPE.US")).json();
    expect(unknown).toMatchObject({ code: "NOPE.US", close: "NA" });
  });

  it("serves eod and fundamentals fixtures", async () => {
    const eod = await call("eod/AAPL.US");
    expect(await eod.json()).toEqual(fixture("eod/AAPL.US.json"));

    const name = await call("fundamentals/AAPL.US?filter=General::Name");
    expect(await name.json()).toBe("Apple Inc");
  });

  it("names the missing file when there is no fixture", async () => {
    const res = await call("eod/ZZZZ.US");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/fixtures\/eod\/ZZZZ\.US\.json/);
  });

  it("feeds the page the whole default watchlist", async () => {
    const result = await quotes(WATCHLIST);
    expect("rows" in result && result.rows.map((r) => r.code)).toEqual(
      WATCHLIST,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
