import { describe, expect, it } from "vitest";
import { type Checked, checkAll, digest, nextRules } from "@/lib/check-all";
import type { Quote } from "@/lib/quotes";
import type { Rule } from "@/lib/rules";

// A price sitting on a 320 threshold and crossing it back and forth, one check a minute.
const SERIES = [
  319.98, 320.01, 319.99, 320.02, 319.97, 320.05, 320.03, 319.98, 320.04, 320.06, 319.99,
  320.01, 319.96, 320.02, 319.98, 320.03, 319.97, 320.01,
];
const START = Date.UTC(2026, 10, 6, 14, 30);

const rule: Rule = {
  id: "aapl-320",
  ticker: "AAPL.US",
  field: "close",
  op: "crosses_above",
  value: 320,
  enabled: true,
  lastFiredAt: null,
  lastValue: null,
  cooldownMin: 60,
  rearm: 319,
  armed: true,
  heldLastCheck: false,
};

const quoteAt = (i: number): Quote => ({
  code: "AAPL.US",
  timestamp: START / 1000 + i * 60, // the observation's own time
  close: SERIES[i],
  previousClose: 318,
  change: SERIES[i] - 318,
  change_p: 0.6,
  volume: 1000,
});

/** Replay the series through checkAll with a fake clock; return every firing. */
async function replay(guards: boolean, seen = new Set<string>()): Promise<Checked[]> {
  let rules = [rule];
  const fired: Checked[] = [];
  for (let i = 0; i < SERIES.length; i++) {
    const checked = await checkAll(rules, async () => [quoteAt(i)], START + i * 60_000, {
      guards,
      seen,
    });
    fired.push(...checked.filter((c) => c.fires));
    rules = nextRules(rules, checked);
  }
  return fired;
}

describe("a price flapping round its threshold", () => {
  it("fires 8 times with the guards off", async () => {
    expect(await replay(false)).toHaveLength(8);
  });

  it("fires once with cooldown, hysteresis and the two-check debounce on", async () => {
    const fired = await replay(true);
    expect(fired).toHaveLength(1);
    expect(fired[0].value).toBe(320.03); // the second check in a row above 320
  });

  it("fires nothing more when the same run is replayed: every key was already seen", async () => {
    const seen = new Set<string>();
    expect(await replay(true, seen)).toHaveLength(1);
    expect(await replay(true, seen)).toHaveLength(0);
  });
});

describe("digest", () => {
  it("is one message, a line each with symbol, value, rule and UTC time", async () => {
    const fired = await replay(true);
    expect(digest(fired)).toBe("AAPL.US 320.03, crossed above 320.00, 14:36 UTC");
    expect(digest([])).toBeNull();
  });
});
