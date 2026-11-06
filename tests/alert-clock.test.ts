import { describe, expect, it, vi } from "vitest";
import { tradingDate } from "@/lib/alerts/clock";
import { withRetry } from "@/lib/alerts/retry";
import type { Rule } from "@/lib/alerts/rules";
import { runAlerts } from "@/lib/alerts/run";
import { emptyState, type State } from "@/lib/alerts/state";

// One test per line under "Clock cases" in PLAN.md, named after it. Every test sets its
// own instant; none reads the real clock, so none passes on a Tuesday and fails on a Saturday.

const rule: Rule = { id: "nvda-above-185", symbol: "NVDA.US", op: "crosses_above", value: 185 };

function run(now: Date, state: State = emptyState()) {
  const fetchBars = vi.fn(async () => [
    { date: "2026-01-13", close: 182.1 },
    { date: "2026-01-14", close: 186.75 },
  ]);
  const result = runAlerts({
    rules: [rule],
    state,
    now,
    fetchBars,
    send: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
    log: () => {},
  });
  return { result, fetchBars };
}

describe("Clock cases", () => {
  it("21:30 UTC on 2026-07-14 is trading date 2026-07-14: 17:30 in New York, summer time", () => {
    expect(tradingDate(new Date("2026-07-14T21:30:00Z"))).toBe("2026-07-14");
  });

  it("22:30 UTC on 2026-01-14 is trading date 2026-01-14: 17:30 in New York, winter time", () => {
    expect(tradingDate(new Date("2026-01-14T22:30:00Z"))).toBe("2026-01-14");
  });

  it("01:00 UTC on 2026-01-15 is trading date 2026-01-14", () => {
    expect(tradingDate(new Date("2026-01-15T01:00:00Z"))).toBe("2026-01-14");
  });

  it("00:30 UTC on 2026-07-15, the 20:30 catch-up run in summer, is trading date 2026-07-14", () => {
    expect(tradingDate(new Date("2026-07-15T00:30:00Z"))).toBe("2026-07-14");
  });

  it("15:00 UTC on 2026-01-17 has no trading date, and the run fetches nothing", async () => {
    const saturday = new Date("2026-01-17T15:00:00Z");
    expect(tradingDate(saturday)).toBeNull();

    const { result, fetchBars } = run(saturday);
    await expect(result).resolves.toEqual({ fetched: [], sent: [] });
    expect(fetchBars).not.toHaveBeenCalled();
  });

  it("A run with every symbol already processed today spends 0 calls", async () => {
    const state: State = { symbols: { "NVDA.US": "2026-01-14" }, keys: {} };
    const { result, fetchBars } = run(new Date("2026-01-15T01:00:00Z"), state);
    await expect(result).resolves.toEqual({ fetched: [], sent: [] });
    expect(fetchBars).not.toHaveBeenCalled();
  });

  it("A 5xx is retried after 1 second and then 2; a 402 is not retried", async () => {
    const wait = vi.fn(async () => {});
    const flaky = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    await withRetry(flaky, wait, "for rule nvda-above-185");
    expect(wait.mock.calls).toEqual([[1_000], [2_000]]);

    const spent = vi.fn(async () => new Response("", { status: 402 }));
    const noWait = vi.fn(async () => {});
    await expect(withRetry(spent, noWait, "for rule nvda-above-185")).rejects.toMatchObject({
      status: 402,
    });
    expect(spent).toHaveBeenCalledTimes(1);
    expect(noWait).not.toHaveBeenCalled();
  });
});
