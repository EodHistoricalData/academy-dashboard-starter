import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quotes } from "@/lib/quotes";

// Statuses and bodies as the API sent them back to the watchlist's request.
function upstream(status: number, body: string, headers: HeadersInit = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers })),
  );
}

beforeEach(() => {
  vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
  vi.stubEnv("EODHD_MOCK", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the watchlist says which failure it is", () => {
  it("a rejected key is a 401, not an empty list", async () => {
    upstream(401, "Unauthenticated", { "content-type": "text/html" });
    expect(await quotes(["AAPL.US", "MSFT.US"])).toEqual({
      failure: { kind: "rejected", status: 401 },
    });
  });

  it("a plan that does not cover the request is a 403", async () => {
    upstream(403, "Forbidden");
    expect(await quotes(["AAPL.US"])).toEqual({
      failure: { kind: "rejected", status: 403 },
    });
  });

  it("a spent day is a 402, apart from a busy minute", async () => {
    upstream(402, '{"message":"limit"}');
    expect(await quotes(["AAPL.US"])).toEqual({ failure: { kind: "quota" } });

    upstream(429, "Too Many Requests", { "retry-after": "30" });
    expect(await quotes(["AAPL.US"])).toEqual({
      failure: { kind: "rate-limit", retryAfter: "30" },
    });
  });

  it("a request that never answers is unreachable, not a crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await quotes(["AAPL.US"])).toEqual({
      failure: { kind: "unreachable", status: null },
    });
  });
});

// Criterion: with no key set and mock mode off, the watchlist says the key is missing and
// sends nothing. The API answers a missing key and a wrong one with the same 401, so only
// the tool can tell them apart, and only by looking before it asks.
describe("no key", () => {
  it("is reported before any request is sent", async () => {
    vi.stubEnv("EODHD_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await quotes(["AAPL.US", "MSFT.US"])).toEqual({
      failure: { kind: "no-key" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
