import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allow } from "@/lib/rate-limit";

// The proxy reads today's count through src/lib/usage.ts; here it is whatever a test says.
const count = vi.hoisted(() => ({ used: 0 as number | null, limit: 20 as number | null }));
vi.mock("@/lib/usage", () => ({ todayCount: async () => ({ ...count }) }));

const { GET } = await import("@/app/api/proxy/[...path]/route");

function call(path: string, caller: string) {
  const url = new URL(`http://localhost/api/proxy/${path}`);
  return GET(new NextRequest(url, { headers: { "x-forwarded-for": caller } }), {
    params: Promise.resolve({ path: path.split("/") }),
  });
}

describe("allow: at most 30 requests a minute from one address", () => {
  it("refuses the 31st, and serves the same address again once the minute has passed", () => {
    const hits = new Map<string, number[]>();
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) expect(allow(hits, "203.0.113.7", t0 + i)).toBe(true);
    expect(allow(hits, "203.0.113.7", t0 + 30)).toBe(false);
    expect(allow(hits, "198.51.100.2", t0 + 30)).toBe(true); // another caller is not affected
    expect(allow(hits, "203.0.113.7", t0 + 60_000)).toBe(true); // a fake clock, no waiting
  });

  it("keeps its memory bounded", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 5_001; i++) allow(hits, `10.0.${i >> 8}.${i & 255}`, 0);
    allow(hits, "one-more", 0);
    expect(hits.size).toBeLessThanOrEqual(1);
  });
});

describe("the proxy, with both limits", () => {
  beforeEach(() => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
    count.used = 0;
    count.limit = 20;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("makes no upstream request past the quota policy's stage, and says why", async () => {
    const fetchMock = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    count.used = 18; // past every stage but a refresh by hand; this request says nothing
    const res = await call("eod/AAPL.US", "192.0.2.10");
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/18 of 20/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After to one address asking too often, and not to another", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]")));
    for (let i = 0; i < 30; i++) expect((await call("eod/AAPL.US", "192.0.2.20")).status).toBe(200);
    const refused = await call("eod/AAPL.US", "192.0.2.20");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await refused.json()).error).toMatch(/30 a minute/);
    expect((await call("eod/AAPL.US", "192.0.2.21")).status).toBe(200);
  });
});
