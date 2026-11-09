import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Bar } from "@/lib/backtest/candles";
import { backtest, costShare, DEFAULTS } from "@/lib/backtest/strategy";

const spy: Bar[] = JSON.parse(readFileSync("fixtures/eod/SPY.US.json", "utf8"));

describe("cost share", () => {
  it("is what was paid, as a share of the start and of the gross gain", () => {
    const run = backtest(spy, DEFAULTS);
    const gross = run.gross.at(-1)! - 1;
    const net = run.net.at(-1)! - 1;
    const share = costShare(run);
    expect(share.ofStart).toBeCloseTo(gross - net, 12);
    expect(share.ofGross).toBeCloseTo((gross - net) / gross, 12);
  });

});
