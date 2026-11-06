import { describe, expect, it, vi } from "vitest";
import { DeliveryError, type Message } from "@/lib/alerts/deliver";
import { failureReason, staleness, weekdaysBetween } from "@/lib/alerts/outcome";
import { FetchError } from "@/lib/alerts/retry";
import { parseRules, RuleError } from "@/lib/alerts/rules";
import { runAlerts } from "@/lib/alerts/run";
import type { State } from "@/lib/alerts/state";

// Fixed instants only: 2026-01-15 is a Thursday, 2026-01-16 a Friday, 17:30 New York (EST)
// is 22:30 UTC.
const THURSDAY = new Date("2026-01-15T22:30:00Z");
const FRIDAY = new Date("2026-01-16T22:30:00Z");

const rules = parseRules([
  { id: "nvda-above-185", symbol: "NVDA.US", op: "crosses_above", value: 185 },
  { id: "aapl-below-240", symbol: "AAPL.US", op: "crosses_below", value: 240 },
]);

describe("stale data", () => {
  it("is fine when the newest bar is one weekday old", () => {
    expect(staleness(["NVDA.US"], { "NVDA.US": "2026-01-15" }, "2026-01-16")).toBeNull();
    // Friday's bar on a Monday is one weekday behind, not three days.
    expect(staleness(["NVDA.US"], { "NVDA.US": "2026-01-16" }, "2026-01-19")).toBeNull();
  });

  it("is a failure when the newest bar is two weekdays old", () => {
    expect(staleness(["NVDA.US"], { "NVDA.US": "2026-01-14" }, "2026-01-16")).toBe(
      "stale data: NVDA.US newest bar 2026-01-14, 2 weekdays behind 2026-01-16",
    );
  });

  it("is a failure for a symbol that never answered with a bar", () => {
    expect(staleness(["NVDA.US"], {}, "2026-01-16")).toMatch(/NVDA.US has no bar/);
  });

  it("counts weekdays, not days", () => {
    expect(weekdaysBetween("2026-01-16", "2026-01-16")).toBe(0);
    expect(weekdaysBetween("2026-01-15", "2026-01-19")).toBe(2);
  });
});

describe("the Friday digest", () => {
  function judgedToday(date: string): State {
    return {
      symbols: { "NVDA.US": date, "AAPL.US": date },
      keys: {
        "nvda-above-185:2026-01-13": { status: "sent", sent: "2026-01-13" },
        "nvda-above-185:2026-01-08": { status: "sent", sent: "2026-01-08" },
      },
    };
  }

  function run(now: Date, state: State) {
    const sent: Message[] = [];
    const fetchBars = vi.fn(async () => []);
    const done = runAlerts({
      rules,
      state,
      now,
      fetchBars,
      send: async (m) => void sent.push(m),
      save: async () => {},
      log: () => {},
    });
    return { done, sent, fetchBars };
  }

  it("is sent on a Friday, from the state alone", async () => {
    const r = run(FRIDAY, judgedToday("2026-01-16"));
    await r.done;
    expect(r.fetchBars).not.toHaveBeenCalled();
    expect(r.sent.map((m) => m.text.split("\n")[0])).toEqual([
      "Still watching 2 rules on 2 symbols. Newest bar 2026-01-16. Alerts this week: 1.",
    ]);
  });

  it("is not sent on a Thursday", async () => {
    const r = run(THURSDAY, judgedToday("2026-01-15"));
    await r.done;
    expect(r.sent).toEqual([]);
  });

  it("is sent once, not again by the 20:30 run the same Friday", async () => {
    const state = judgedToday("2026-01-16");
    await run(FRIDAY, state).done;
    const later = run(new Date("2026-01-17T01:30:00Z"), state);
    await later.done;
    expect(later.sent).toEqual([]);
  });
});

describe("failureReason", () => {
  it("gives one line for each kind of failure", () => {
    expect(failureReason(new FetchError("402: today's API calls are spent.", 402))).toMatch(/^402/);
    expect(failureReason(new RuleError('Rule "x": unknown op "up".'))).toBe(
      'invalid rule: Rule "x": unknown op "up".',
    );
    expect(failureReason(new DeliveryError("telegram", 400))).toBe(
      "delivery error: delivery failed: telegram, HTTP 400",
    );
    expect(failureReason(new Error("first line\nsecond line"))).toBe("first line");
  });
});
