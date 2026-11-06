import { describe, expect, it } from "vitest";
import { evaluate, type Bar } from "@/lib/alerts/evaluate";
import type { Rule } from "@/lib/alerts/rules";

const above: Rule = { id: "up", symbol: "AAPL.US", op: "crosses_above", value: 100 };
const below: Rule = { id: "down", symbol: "AAPL.US", op: "crosses_below", value: 100 };

const bars = (...closes: number[]): Bar[] =>
  closes.map((close, i) => ({ date: `2026-01-${String(10 + i).padStart(2, "0")}`, close }));

describe("evaluate", () => {
  it("fires when the last close crosses up through the threshold", () => {
    expect(evaluate(above, bars(97, 99, 101))).toBe(true);
    expect(evaluate(below, bars(97, 99, 101))).toBe(false);
  });

  it("fires when the last close crosses down through the threshold", () => {
    expect(evaluate(below, bars(103, 101, 99))).toBe(true);
    expect(evaluate(above, bars(103, 101, 99))).toBe(false);
  });

  it("stays quiet when the last two closes are on the same side", () => {
    expect(evaluate(above, bars(102, 104))).toBe(false);
    expect(evaluate(below, bars(98, 96))).toBe(false);
    // An older crossing is not this bar's news: only the last two closes count.
    expect(evaluate(above, bars(98, 102, 104))).toBe(false);
  });

  it("does not fire on a close exactly on the threshold, and fires on the next one beyond it", () => {
    expect(evaluate(above, bars(99, 100))).toBe(false);
    expect(evaluate(above, bars(99, 100, 101))).toBe(true);
    expect(evaluate(below, bars(101, 100))).toBe(false);
    expect(evaluate(below, bars(101, 100, 99))).toBe(true);
  });

  it("stays quiet with fewer than two bars", () => {
    expect(evaluate(above, bars(101))).toBe(false);
    expect(evaluate(above, [])).toBe(false);
  });
});
