import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditAdjustments,
  toDividends,
  toSplits,
} from "@/lib/backtest/adjustment";
import type { Bar } from "@/lib/backtest/candles";

const bar = (date: string, close: number, adjusted_close: number): Bar => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  adjusted_close,
  volume: 1,
});

// Apple around its 2020 dividend and split, as /eod, /div and /splits answered on
// 2026-11-13. The dividend's `value` is 0.205 and its `unadjustedValue` 0.82: the first is
// restated in today's shares, the second is what was paid.
const aapl: Bar[] = [
  bar("2020-08-06", 455.61, 110.1049),
  bar("2020-08-07", 444.45, 107.6016), // ex-dividend, 0.82 a share
  bar("2020-08-10", 450.91, 109.1655),
  bar("2020-08-27", 500.04, 121.0599),
  bar("2020-08-28", 499.23, 120.8638),
  bar("2020-08-31", 129.04, 124.9626), // four for one
  bar("2020-09-01", 134.18, 129.9402),
];
const aaplDividends = toDividends([
  { date: "2020-08-07", value: 0.205, unadjustedValue: 0.82, currency: "USD" },
]);
const aaplSplits = toSplits([{ date: "2020-08-31", split: "4.000000/1.000000" }]);

describe("auditAdjustments on real data", () => {
  it("finds every step of Apple's factor in the record, and nothing else", () => {
    expect(auditAdjustments(aapl, aaplDividends, aaplSplits)).toEqual([]);
  });

  it("reports the split day when the split is missing from the record", () => {
    const problems = auditAdjustments(aapl, aaplDividends, []);
    expect(problems.map((p) => p.date)).toEqual(["2020-08-31"]);
    expect(problems[0].found).toBeCloseTo(4, 4);
  });

  it("reports the dividend when it is read from `value` instead of the cash paid", () => {
    const restated = [{ date: "2020-08-07", unadjustedValue: 0.205 }];
    expect(auditAdjustments(aapl, restated, aaplSplits).map((p) => p.date)).toEqual([
      "2020-08-07",
    ]);
  });

  it("reports the join when an old pull is extended with a new one", () => {
    // 2020-08-27 and 08-28 as /eod gave them on 2026-08-25, the pull the returns lesson
    // quotes, followed by the 2026-11-13 pull: one Apple dividend apart. Each pull is
    // right on its own, and the join is the step nobody paid.
    const spliced = [
      bar("2020-08-27", 500.04, 121.1519),
      bar("2020-08-28", 499.23, 120.9557),
      ...aapl.slice(5),
    ];
    expect(auditAdjustments(spliced, aaplDividends, aaplSplits).map((p) => p.date)).toEqual([
      "2020-08-31",
    ]);
  });

  it("checks a split on the next bar when its own day is missing from the history", () => {
    const gap = aapl.filter((b) => b.date !== "2020-08-31");
    expect(auditAdjustments(gap, aaplDividends, aaplSplits)).toEqual([]);
    // And the same gap on a history that was never adjusted is caught there.
    const raw = gap.map((b) => ({ ...b, adjusted_close: b.close }));
    expect(auditAdjustments(raw, aaplDividends, aaplSplits).map((p) => p.date)).toContain(
      "2020-09-01",
    );
  });

  it("reports a bar whose closes give no factor", () => {
    const zero = aapl.map((b, i) => (i === 2 ? { ...b, adjusted_close: 0 } : b));
    expect(auditAdjustments(zero, aaplDividends, aaplSplits).map((p) => p.date)).toEqual([
      "2020-08-10",
      "2020-08-27",
    ]);
  });

  it("reports every day when the two closes are swapped", () => {
    const swapped = aapl.map((b) => ({ ...b, close: b.adjusted_close, adjusted_close: b.close }));
    expect(auditAdjustments(swapped, aaplDividends, aaplSplits).length).toBeGreaterThan(0);
  });
});

describe("auditAdjustments on the mock year", () => {
  const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));
  const dividends = toDividends(
    JSON.parse(readFileSync("fixtures/div/SPY.US.json", "utf8")),
  );
  const splits = toSplits(JSON.parse(readFileSync("fixtures/splits/SPY.US.json", "utf8")));

  it("matches the four dividends the fixtures carry", () => {
    expect(dividends).toHaveLength(4);
    expect(auditAdjustments(spy, dividends, splits)).toEqual([]);
  });

  it("reports a dividend the bars do not show", () => {
    const extra = [...dividends, { date: "2026-02-13", unadjustedValue: 1.8 }];
    expect(auditAdjustments(spy, extra, splits).map((p) => p.date)).toEqual(["2026-02-13"]);
  });
});

describe("toDividends and toSplits", () => {
  it("keep only rows of the documented shape", () => {
    expect(toDividends([{ date: "2020-08-07", value: 0.205 }, null, "x"])).toEqual([]);
    expect(toSplits([{ date: "2020-08-31", split: "4:1" }])).toEqual([]);
    expect(toDividends({ error: "nope" })).toEqual([]);
  });
});
