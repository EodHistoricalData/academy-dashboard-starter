import { describe, expect, it } from "vitest";
import { parseRules, readRules } from "@/lib/alerts/rules";

const rule = (over: Record<string, unknown> = {}) => ({
  id: "aapl-above-260",
  symbol: "AAPL.US",
  op: "crosses_above",
  value: 260,
  ...over,
});

describe("parseRules", () => {
  it("accepts well-formed rules", () => {
    expect(parseRules([rule(), rule({ id: "btc", symbol: "BTC-USD.CC" })])).toHaveLength(2);
  });

  it("stops on an unknown op, naming the rule", () => {
    expect(() => parseRules([rule({ op: "above" })])).toThrow(/aapl-above-260.*unknown op/);
  });

  it("stops on a symbol without an exchange suffix, naming the rule", () => {
    expect(() => parseRules([rule({ symbol: "AAPL" })])).toThrow(/aapl-above-260.*exchange suffix/);
  });

  it("stops on a duplicate id, naming it", () => {
    expect(() => parseRules([rule(), rule()])).toThrow(/"aapl-above-260" is defined twice/);
  });

  it("stops on a value that is not a number", () => {
    expect(() => parseRules([rule({ value: "260" })])).toThrow(/aapl-above-260.*number/);
  });

  it("accepts the repository's own alerts/rules.json", async () => {
    await expect(readRules()).resolves.not.toHaveLength(0);
  });
});
