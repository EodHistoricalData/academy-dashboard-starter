import { afterEach, describe, expect, it, vi } from "vitest";

// The store is whatever a test says: readable, or not.
const storeState = vi.hoisted(() => ({ readable: true }));
vi.mock("@/lib/store", () => ({
  storeReadable: () => storeState.readable,
}));

const { GET } = await import("@/app/api/health/route");

afterEach(() => {
  storeState.readable = true;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/health", () => {
  it("is ok with both halves up, carries the count, and never the e-mail address", async () => {
    vi.stubEnv("EODHD_MOCK", "1"); // the user fixture: 0 of 20
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, store: "up", upstream: "up", calls_used: 0, daily_limit: 20 });
    expect(JSON.stringify(body)).not.toMatch(/@|learner/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is 503 with the store down and upstream still up", async () => {
    vi.stubEnv("EODHD_MOCK", "1");
    storeState.readable = false;
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, store: "down", upstream: "up" });
  });

  it("is 503 with upstream down, and asks only the free user endpoint", async () => {
    vi.stubEnv("EODHD_MOCK", "");
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, store: "up", upstream: "down", calls_used: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toMatch(/\/api\/user\?/);
  });
});
