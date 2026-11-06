import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Params } from "@/lib/backtest/strategy";

/**
 * Every run, appended automatically: parameters, result, when. Not for tidiness — so that
 * the number reported can say how many attempts it took to find. Twelve attempts is normal;
 * twelve reported as one is the problem. A manual log is a log you stop keeping on the day
 * it matters, so nothing here is optional.
 *
 * One JSON object per line in .cache/runs.jsonl (gitignored: it is your research history,
 * not the tool's code). A read-only disk skips the write; the count then says so.
 */
export const RUN_LOG = path.join(process.cwd(), ".cache", "runs.jsonl");

export type LoggedRun = {
  at: string;
  symbol: string;
  params: Params;
  netReturn: number;
  trades: number;
};

export async function appendRun(run: LoggedRun, file = RUN_LOG): Promise<boolean> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${JSON.stringify(run)}\n`);
    return true;
  } catch {
    return false;
  }
}

/** The runs logged so far, oldest first. Lines that are not runs are skipped. */
export async function readRuns(file = RUN_LOG): Promise<LoggedRun[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return [];
  }
  return text.split("\n").flatMap((line) => {
    try {
      const run = JSON.parse(line) as LoggedRun;
      return typeof run?.params?.fast === "number" ? [run] : [];
    } catch {
      return [];
    }
  });
}

/** How many distinct parameter sets were tried on a symbol: the line an honest report needs. */
export function paramSetsTried(runs: LoggedRun[], symbol: string): number {
  return new Set(
    runs.filter((r) => r.symbol === symbol).map((r) => JSON.stringify(r.params)),
  ).size;
}
