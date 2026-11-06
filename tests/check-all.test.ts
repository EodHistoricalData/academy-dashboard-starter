import { describe, expect, it } from "vitest";
import { checkAll } from "@/lib/check-all";
import type { Quote } from "@/lib/quotes";
import type { Rule } from "@/lib/rules";

const quote = (code: string, close: number): Quote => ({
  code,
  timestamp: 1793390400,
  close,
  previousClose: close,
  change: 0,
  change_p: 0,
  volume: 1000,
});

const rule = (id: string, ticker: string, op: Rule["op"], value: number): Rule => ({
  id,
  ticker,
  field: "close",
  op,
  value,
  enabled: true,
  lastFiredAt: null,
  lastValue: null,
});

const AT = Date.UTC(2026, 10, 6, 14, 32);

describe("checkAll", () => {
  it("asks once for the distinct symbols, even with two rules on one symbol", async () => {
    const asked: string[][] = [];
    const fetchQuotes = async (symbols: string[]) => {
      asked.push(symbols);
      return [quote("AAPL.US", 321)];
    };
    const results = await checkAll(
      [rule("a", "AAPL.US", ">", 320), rule("b", "AAPL.US", "<", 300)],
      fetchQuotes,
      AT,
    );
    expect(asked).toEqual([["AAPL.US"]]);
    expect(results.map((r) => [r.rule.id, r.fires, r.nextLastValue, r.checkedAt])).toEqual([
      ["a", true, 321, AT],
      ["b", false, 321, AT],
    ]);
  });

  it("skips switched-off rules, and asks for nothing when none are on", async () => {
    let calls = 0;
    const results = await checkAll(
      [{ ...rule("a", "AAPL.US", ">", 1), enabled: false }],
      async () => {
        calls++;
        return [];
      },
      AT,
    );
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it("keeps a rule's last value when its symbol did not come back", async () => {
    const r = { ...rule("a", "NOTREAL.US", ">", 1), lastValue: 5 };
    const [result] = await checkAll([r], async () => [], AT);
    expect(result).toMatchObject({ fires: false, nextLastValue: 5 });
  });
});
