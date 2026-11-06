import { describe, expect, it } from "vitest";
import type { Quote } from "@/lib/quotes";
import {
  alertText,
  evaluate,
  fires,
  firedAlerts,
  parseRules,
  type Rule,
  ruleSentence,
} from "@/lib/rules";

// A quote as the API returns it, with the numbers written in by hand.
const aapl: Quote = {
  code: "AAPL.US",
  timestamp: 1793390400,
  close: 251.32,
  previousClose: 260.17,
  change: -8.85,
  change_p: -3.4,
  volume: 48211370,
};

/** A rule document with the state fields at their starting values. */
const rule = (r: Pick<Rule, "ticker" | "field" | "op" | "value"> & Partial<Rule>): Rule => ({
  id: `${r.ticker}-${r.field}-${r.op}-${r.value}`,
  enabled: true,
  lastFiredAt: null,
  lastValue: null,
  cooldownMin: 60,
  rearm: r.value,
  armed: true,
  heldLastCheck: false,
  ...r,
});

const downThree = rule({ ticker: "AAPL.US", field: "change_p", op: "<", value: -3 });

describe("fires", () => {
  it("fires when the move is past the threshold", () => {
    expect(fires(downThree, aapl)).toBe(true);
  });

  it("does not fire when the move falls short of it", () => {
    expect(fires(downThree, { ...aapl, change_p: -2.9 })).toBe(false);
  });

  it("compares the close for a price rule", () => {
    expect(fires(rule({ ticker: "AAPL.US", field: "close", op: ">", value: 250 }), aapl)).toBe(true);
    expect(fires(rule({ ticker: "AAPL.US", field: "close", op: "<", value: 250 }), aapl)).toBe(false);
  });
});

describe("evaluate", () => {
  const above320 = rule({ ticker: "AAPL.US", field: "close", op: "crosses_above", value: 320 });
  const below320 = rule({ ticker: "AAPL.US", field: "close", op: "crosses_below", value: 320 });

  it("crossing up: fires once, when the last value was at or under and this one is over", () => {
    expect(evaluate({ ...above320, lastValue: 319.98 }, { ...aapl, close: 320.01 })).toMatchObject({
      fires: true,
      nextLastValue: 320.01,
    });
    expect(evaluate({ ...above320, lastValue: 320.01 }, { ...aapl, close: 320.4 }).fires).toBe(false);
    expect(evaluate({ ...above320, lastValue: null }, { ...aapl, close: 320.4 }).fires).toBe(false);
  });

  it("crossing down: fires when the last value was at or over and this one is under", () => {
    expect(evaluate({ ...below320, lastValue: 320.02 }, { ...aapl, close: 319.97 }).fires).toBe(true);
    expect(evaluate({ ...below320, lastValue: 319.5 }, { ...aapl, close: 319.4 }).fires).toBe(false);
  });

  it("exactly on the threshold: for > and crosses_above, equal does not fire", () => {
    const over = rule({ ticker: "AAPL.US", field: "close", op: ">", value: 320 });
    expect(evaluate(over, { ...aapl, close: 320 }).fires).toBe(false);
    expect(evaluate({ ...above320, lastValue: 319.9 }, { ...aapl, close: 320 }).fires).toBe(false);
  });

  it("a quote without the field does not fire and keeps the last value", () => {
    const busy = rule({ ticker: "AAPL.US", field: "volume", op: ">", value: 1, lastValue: 7 });
    expect(evaluate(busy, { ...aapl, volume: null })).toMatchObject({ fires: false, nextLastValue: 7 });
  });
});

describe("parseRules", () => {
  it("drops a rule whose operator or field is not on the list, rather than repairing it", () => {
    const stored = [
      downThree,
      { ...downThree, id: "b", op: ">=" },
      { ...downThree, id: "c", field: "dividend_yield" },
    ];
    expect(parseRules(stored).map((r) => r.id)).toEqual([downThree.id]);
    expect(parseRules("not a list")).toEqual([]);
  });

  it("drops a rule whose ticker is not shaped like a ticker: it goes into a request path", () => {
    const stored = [
      { ...downThree, id: "q", ticker: "AAPL.US?filter=last_close" },
      { ...downThree, id: "p", ticker: "../user" },
      { ...downThree, id: "ok", ticker: "BRK-B.US" },
    ];
    expect(parseRules(stored).map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("ruleSentence", () => {
  it("says the symbol, the threshold and which price it is checked against", () => {
    expect(ruleSentence(rule({ ticker: "AAPL.US", field: "close", op: ">", value: 320 }))).toBe(
      "Alert when AAPL.US trades above 320.00 (checked against the last price, not the session close)",
    );
    expect(ruleSentence(downThree)).toBe(
      "Alert when AAPL.US’s change since the previous close is below −3%",
    );
  });
});

describe("alertText", () => {
  it("names the ticker, the move and the rule", () => {
    expect(alertText(downThree, aapl)).toBe("AAPL.US down 3.4% — your rule was −3%");
  });

  it("names the price for a price rule", () => {
    expect(alertText(rule({ ticker: "AAPL.US", field: "close", op: ">", value: 250 }), aapl)).toBe(
      "AAPL.US at 251.32 — your rule was above 250",
    );
  });
});

describe("firedAlerts", () => {
  it("only fires for a ticker that has prices on this load", () => {
    const rules: Rule[] = [downThree, { ...downThree, ticker: "NOTREAL.US" }];
    const alerts = firedAlerts(rules, [aapl, { code: "NOTREAL.US", status: "unavailable" }]);
    expect(alerts).toEqual([{ rule: downThree, quote: aapl }]);
  });

  it("skips a rule that is switched off", () => {
    expect(firedAlerts([{ ...downThree, enabled: false }], [aapl])).toEqual([]);
  });
});
