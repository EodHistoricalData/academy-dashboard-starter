import { describe, expect, it, vi } from "vitest";
import type { Message } from "@/lib/alerts/deliver";
import type { Bar } from "@/lib/alerts/evaluate";
import { FetchError, withRetry } from "@/lib/alerts/retry";
import type { Rule } from "@/lib/alerts/rules";
import { idempotencyKey, runAlerts } from "@/lib/alerts/run";
import { emptyState, parseState, type State } from "@/lib/alerts/state";

const nvda: Rule = { id: "nvda-above-185", symbol: "NVDA.US", op: "crosses_above", value: 185 };
const aapl: Rule = { id: "aapl-above-260", symbol: "AAPL.US", op: "crosses_above", value: 260 };

const bars = (...rows: [string, number][]): Bar[] =>
  rows.map(([date, close]) => ({ date, close }));

// The crossing is on the last bar: 182.10, then 186.75 over a threshold of 185.
const CROSSING = bars(["2026-10-28", 180.75], ["2026-10-29", 182.1], ["2026-10-30", 186.75]);
const FLAT = bars(["2026-10-29", 248.9], ["2026-10-30", 251.32]);

/** One run against a fake API and a fake channel. Nothing here reads a clock or a network. */
function harness(data: Record<string, Bar[] | Error>, failSends = 0) {
  const sent: { message: Message; key: string }[] = [];
  let failuresLeft = failSends;
  const fetchBars = vi.fn(async (symbol: string) => {
    const answer = data[symbol];
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const send = vi.fn(async (message: Message, key: string) => {
    if (failuresLeft-- > 0) throw new Error("delivery failed: telegram, HTTP 502");
    sent.push({ message, key });
  });
  const saved: State[] = [];
  // 17:30 in New York on the given date (EDT until 2026-11-01, EST after).
  const run = (state: State, day: string, rules: Rule[] = [nvda, aapl]) =>
    runAlerts({
      rules,
      state,
      now: new Date(`${day}T17:30:00${day < "2026-11-01" ? "-04:00" : "-05:00"}`),
      fetchBars,
      send,
      save: async (s) => void saved.push(structuredClone(s)),
      log: () => {},
    });
  return { run, fetchBars, send, sent, saved };
}

describe("an idempotent alert run", () => {
  it("sends once when two runs see the same data", async () => {
    const h = harness({ "NVDA.US": CROSSING, "AAPL.US": FLAT });
    const state = emptyState();

    await h.run(state, "2026-10-30");
    await h.run(state, "2026-10-30");
    // And a run on the next trading day, before a new bar exists: it asks, finds nothing new.
    await h.run(state, "2026-11-02");

    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].key).toBe("nvda-above-185:2026-10-30");
    expect(h.fetchBars).toHaveBeenCalledTimes(4); // two symbols on the 30th, two on the 2nd
    expect(state.keys["nvda-above-185:2026-10-30"]).toEqual({ status: "sent", sent: "2026-10-30" });
  });

  it("sends a failed alert on the next run, before anything else", async () => {
    const h = harness({ "NVDA.US": CROSSING, "AAPL.US": FLAT }, 1);
    const state = emptyState();

    await expect(h.run(state, "2026-10-30")).rejects.toThrow(/delivery failed/);
    expect(state.keys["nvda-above-185:2026-10-30"]).toEqual({ status: "pending", sent: null });
    // The pending mark was saved before the send was tried.
    expect(h.saved.at(-1)?.keys["nvda-above-185:2026-10-30"]?.status).toBe("pending");

    const second = await h.run(state, "2026-10-30");
    expect(second.sent).toEqual(["nvda-above-185:2026-10-30"]);
    expect(h.sent[0].message.text).toContain("nvda-above-185, resent");
    expect(state.keys["nvda-above-185:2026-10-30"].status).toBe("sent");
    // Both symbols were judged in the first run, so the second fetched nothing.
    expect(h.fetchBars).toHaveBeenCalledTimes(2);
  });

  it("gives a missed day its own key", async () => {
    // Judged up to the 28th; the 29th was missed. The crossing was on the 29th.
    const h = harness({
      "NVDA.US": bars(["2026-10-28", 183.3], ["2026-10-29", 185.4], ["2026-10-30", 186.75]),
    });
    const state = parseState({ symbols: { "NVDA.US": "2026-10-28" }, keys: {} });

    const result = await h.run(state, "2026-10-30", [nvda]);

    expect(result.sent).toEqual(["nvda-above-185:2026-10-29"]);
    expect(state.symbols["NVDA.US"]).toBe("2026-10-30");
  });

  it("stops on a 402 without retrying, and asks for no other symbol", async () => {
    const h = harness({
      "NVDA.US": new FetchError("402: today's API calls are spent.", 402),
      "AAPL.US": FLAT,
    });
    await expect(h.run(emptyState(), "2026-10-30")).rejects.toMatchObject({ status: 402 });
    expect(h.fetchBars).toHaveBeenCalledTimes(1);
  });

  it("keeps no price in the state", async () => {
    const h = harness({ "NVDA.US": CROSSING, "AAPL.US": FLAT });
    const state = emptyState();
    await h.run(state, "2026-10-30");
    expect(JSON.stringify(state)).not.toMatch(/186\.75|251\.32/);
  });
});

describe("withRetry", () => {
  const answer = (status: number, headers: Record<string, string> = {}) =>
    new Response("{}", { status, headers });

  it("does not retry a 402", async () => {
    const request = vi.fn(async () => answer(402));
    const wait = vi.fn(async () => {});
    await expect(withRetry(request, wait, "for rule x")).rejects.toMatchObject({ status: 402 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("waits for Retry-After after a 429, and retries once", async () => {
    const request = vi.fn(async () => answer(429, { "retry-after": "7" }));
    const wait = vi.fn(async () => {});
    await expect(withRetry(request, wait, "for rule x")).rejects.toMatchObject({ status: 429 });
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(7_000);
  });

  it("never retries a 403 or a 404, and names the rule", async () => {
    for (const status of [403, 404]) {
      const request = vi.fn(async () => answer(status));
      await expect(withRetry(request, vi.fn(), "for rule nvda-above-185")).rejects.toThrow(
        /nvda-above-185/,
      );
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("gives a 5xx two more tries, then fails", async () => {
    const request = vi.fn(async () => answer(503));
    await expect(withRetry(request, vi.fn(async () => {}), "for rule x")).rejects.toMatchObject({
      status: 503,
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("treats a timeout like a 5xx", async () => {
    const timeout = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    const request = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(answer(200));
    await expect(withRetry(request, vi.fn(async () => {}), "for rule x")).resolves.toBeInstanceOf(
      Response,
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("idempotencyKey", () => {
  it("is the firing key itself for one alert, and stays within Resend's 256 characters", () => {
    expect(idempotencyKey(["nvda-above-185:2026-10-30"])).toBe("nvda-above-185:2026-10-30");
    const many = Array.from({ length: 20 }, (_, i) => `rule-number-${i}:2026-10-30`);
    expect(idempotencyKey(many).length).toBeLessThanOrEqual(256);
    expect(idempotencyKey(many)).toBe(idempotencyKey([...many].reverse()));
  });
});
