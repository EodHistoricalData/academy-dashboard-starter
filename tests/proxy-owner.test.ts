import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, SESSION_COOKIE } from "@/lib/session";

vi.mock("@/lib/usage", () => ({ todayCount: async () => ({ used: 0, limit: 20 }) }));
const { GET } = await import("@/app/api/proxy/[...path]/route");

const SECRET = "a-test-secret-that-is-long-enough-for-hmac";
let n = 0;
const call = (cookie?: string) =>
  GET(
    new NextRequest("http://localhost/api/proxy/eod/AAPL.US", {
      headers: { "x-forwarded-for": `192.0.2.${++n}`, ...(cookie ? { cookie } : {}) },
    }),
    { params: Promise.resolve({ path: ["eod", "AAPL.US"] }) },
  );

describe("with a password set, the proxy spends the owner's calls for the owner only", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
    vi.stubEnv("DASHBOARD_PASSWORD", "correct horse");
    vi.stubEnv("SESSION_SECRET", SECRET);
    fetchMock = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers 401 to a visitor who has not signed in, and sends nothing upstream", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/sign in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the signed-in owner", async () => {
    const cookie = `${SESSION_COOKIE}=${makeSession({ uid: 1, exp: Date.now() + 60_000 }, SECRET)}`;
    expect((await call(cookie)).status).toBe(200);
  });

  it("stays open without a password, as before: mock mode and the course need no sign-in", async () => {
    vi.stubEnv("DASHBOARD_PASSWORD", "");
    expect((await call()).status).toBe(200);
  });
});

describe("in the browser", () => {
  it("reads that 401 as signed out, not as EODHD rejecting the key", async () => {
    const { ProxyError, failureOf } = await import("@/lib/proxy-fetch");
    const body = JSON.stringify({ error: "Sign in at /login first", kind: "signed-out" });
    expect(failureOf(new ProxyError(401, null, body))).toEqual({ kind: "signed-out" });
    expect(failureOf(new ProxyError(401, null, "Unauthenticated"))).toEqual({ kind: "rejected", status: 401 });
  });
});
