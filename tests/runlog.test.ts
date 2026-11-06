import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendRun, paramSetsTried, readRuns } from "@/lib/backtest/runlog";

describe("the run log", () => {
  it("appends every run and counts the parameter sets behind a result", async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), "runs-")), "runs.jsonl");
    const run = (fast: number) => ({
      at: "2026-11-06T09:00:00.000Z",
      symbol: "SPY.US",
      params: { fast, slow: 50, costBps: 10, slippageBps: 5, fill: "next-open" as const },
      netReturn: 0.05,
      trades: 3,
    });
    await appendRun(run(20), file);
    await appendRun(run(10), file);
    await appendRun(run(20), file); // the same set again is not a new attempt
    const runs = await readRuns(file);
    expect(runs).toHaveLength(3);
    expect(paramSetsTried(runs, "SPY.US")).toBe(2);
    expect(paramSetsTried(runs, "AAPL.US")).toBe(0);
  });

  it("skips a line that is not a run, and reads a missing log as empty", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "runs-"));
    const file = path.join(dir, "runs.jsonl");
    await writeFile(file, '{"half a line\n');
    expect(await readRuns(file)).toEqual([]);
    expect(await readRuns(path.join(dir, "none.jsonl"))).toEqual([]);
  });
});
