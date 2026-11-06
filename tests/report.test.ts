import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { DEFAULTS } from "@/lib/backtest/strategy";
import { honestyChecks } from "@/lib/backtest/shuffle";
import { buildReport } from "@/lib/backtest/report";

const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));
const report = buildReport({
  symbol: "SPY.US",
  bars: spy,
  params: DEFAULTS,
  pulledAt: "2026-11-06T09:00:00.000Z",
  paramSetsTried: 3,
  statedOn: "6 November 2026",
});

describe("the generated report", () => {
  it("has every section a sceptical reader needs, in order", () => {
    const sections = [...report.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(sections.map((s) => s.split(",")[0])).toEqual([
      "Claim",
      "Parameters",
      "Data",
      "Assumptions",
      "Results",
      "Robustness",
      "Tests",
      "Not tested",
    ]);
  });

  it("says what it is before anything else", () => {
    expect(report.split("\n")[2]).toMatch(/historical simulation, not advice/);
  });

  it("prints the parameters it ran with and the attempts behind them", () => {
    expect(report).toContain('"slippageBps": 5');
    expect(report).toContain("according to the run log: 3");
    expect(report).toMatch(/15 parameter sets tried/);
  });

  it("states the history it had, and the regimes it did not", () => {
    expect(report).toContain("251 daily bars of SPY.US (2025-10-31 to 2026-10-30");
    expect(report).toMatch(/Regimes not in the sample: 2008, 2020, 2022/);
  });

  it("reports the leak checks as run on this data, and they pass", () => {
    const checks = honestyChecks(spy, DEFAULTS);
    expect(checks.futureMutation && checks.truncation && checks.fillRange.passed).toBe(true);
    expect(report).not.toContain("FAILED");
  });
});
