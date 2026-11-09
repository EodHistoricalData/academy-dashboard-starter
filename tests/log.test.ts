import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/client-error/route";
import { GET } from "@/app/api/proxy/[...path]/route";
import { logEvent } from "@/lib/log";

vi.mock("@/lib/usage", () => ({ todayCount: async () => ({ used: 0, limit: 20 }) }));

let lines: string[] = [];
beforeEach(() => {
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => void lines.push(String(line)));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("logEvent", () => {
  it("writes one line of JSON per event, with the time and the event's name", () => {
    logEvent("thing_happened", { status: 404 });
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).toMatchObject({ event: "thing_happened", status: 404 });
    expect(Date.parse(event.at)).not.toBeNaN();
  });
});

describe("the proxy's upstream errors", () => {
  it("are logged with the status and the path, never the URL, the key or the body", async () => {
    vi.stubEnv("EODHD_API_KEY", "test-key-not-a-real-one");
    vi.stubEnv("EODHD_MOCK", "");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Ticker Not Found.", { status: 404 })));
    const url = new URL("http://localhost/api/proxy/eod/NOPE.US?api_token=sneaky");
    await GET(new NextRequest(url, { headers: { "x-forwarded-for": "192.0.2.50" } }), {
      params: Promise.resolve({ path: ["eod", "NOPE.US"] }),
    });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ event: "proxy_upstream_error", status: 404, path: "eod/NOPE.US" });
    expect(lines[0]).not.toMatch(/api_token|https?:|test-key|Ticker Not Found/);
  });
});

describe("POST /api/client-error", () => {
  const post = (body: string, caller = "192.0.2.60") =>
    POST(
      new NextRequest("http://localhost/api/client-error", {
        method: "POST",
        body,
        headers: { "x-forwarded-for": caller, "content-type": "application/json" },
      }),
    );

  it("logs a crash a browser reported, cut short", async () => {
    const res = await post(JSON.stringify({ message: "x".repeat(5_000), stack: "at Panel\n".repeat(2_000) }));
    expect(res.status).toBe(204);
    const event = JSON.parse(lines[0]);
    expect(event.event).toBe("client_error");
    expect(event.message.length).toBeLessThanOrEqual(500);
    expect(event.stack.length).toBeLessThanOrEqual(2_000);
  });

  it("refuses what is not a report, and an address that reports too often", async () => {
    expect((await post("not json", "192.0.2.61")).status).toBe(400);
    expect((await post(JSON.stringify({ stack: "no message" }), "192.0.2.61")).status).toBe(400);
    const caller = "192.0.2.62";
    for (let i = 0; i < 10; i++) expect((await post('{"message":"m"}', caller)).status).toBe(204);
    expect((await post('{"message":"m"}', caller)).status).toBe(429);
  });
});
