import { describe, expect, it } from "vitest";
import type { Quote } from "@/lib/quotes";
import { alertText, fires, firedAlerts, type Rule } from "@/lib/rules";

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

const downThree: Rule = { ticker: "AAPL.US", field: "change_p", op: "<", value: -3 };

describe("fires", () => {
  it("fires when the move is past the threshold", () => {
    expect(fires(downThree, aapl)).toBe(true);
  });

  it("does not fire when the move falls short of it", () => {
    expect(fires(downThree, { ...aapl, change_p: -2.9 })).toBe(false);
  });

  it("compares the close for a price rule", () => {
    expect(fires({ ticker: "AAPL.US", field: "close", op: ">", value: 250 }, aapl)).toBe(true);
    expect(fires({ ticker: "AAPL.US", field: "close", op: "<", value: 250 }, aapl)).toBe(false);
  });
});

describe("alertText", () => {
  it("names the ticker, the move and the rule", () => {
    expect(alertText(downThree, aapl)).toBe("AAPL.US down 3.4% — your rule was −3%");
  });

  it("names the price for a price rule", () => {
    expect(alertText({ ticker: "AAPL.US", field: "close", op: ">", value: 250 }, aapl)).toBe(
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
});
