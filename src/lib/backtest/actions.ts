import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type Dividend,
  type Split,
  toDividends,
  toSplits,
} from "@/lib/backtest/adjustment";
import { isMock } from "@/lib/eodhd";
import type { Failure } from "@/lib/failure";
import { marketGet } from "@/lib/market";

export type ActionsResult =
  | { dividends: Dividend[]; splits: Split[] }
  | { failure: Failure };

const CACHE = path.join(process.cwd(), ".cache", "actions");

/**
 * A symbol's dividends and splits: two requests, one call each, whatever the range.
 *
 * Kept on disk beside the candles they check, and tied to them: the file records which
 * pull of the history it was fetched with (`pulledAt`), and a history pulled again means
 * the record is fetched again. A record older than the bars would miss the newest
 * dividend, and the check would blame the prices for it.
 */
export async function loadActions(
  symbol: string,
  pulledAt: string,
): Promise<ActionsResult> {
  const file = path.join(CACHE, `${symbol}.json`);
  if (!isMock()) {
    const cached = await readCache(file, pulledAt);
    if (cached) return cached;
  }

  const [div, splits] = await Promise.all([
    marketGet(`div/${symbol}`, {}, toDividends),
    marketGet(`splits/${symbol}`, {}, toSplits),
  ]);
  if (!div.ok) return { failure: div.failure };
  if (!splits.ok) return { failure: splits.failure };

  const result = { dividends: div.value, splits: splits.value };
  if (!isMock()) await writeCache(file, { pulledAt, ...result });
  return result;
}

async function readCache(
  file: string,
  pulledAt: string,
): Promise<{ dividends: Dividend[]; splits: Split[] } | null> {
  try {
    const saved = JSON.parse(await readFile(file, "utf8"));
    if (saved.pulledAt !== pulledAt) return null;
    const splits = Array.isArray(saved.splits)
      ? (saved.splits as Record<string, unknown>[]).flatMap((s): Split[] =>
          typeof s?.date === "string" && typeof s.ratio === "number"
            ? [{ date: s.date, ratio: s.ratio }]
            : [],
        )
      : [];
    return { dividends: toDividends(saved.dividends), splits };
  } catch {
    return null;
  }
}

async function writeCache(
  file: string,
  data: { pulledAt: string; dividends: Dividend[]; splits: Split[] },
): Promise<void> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data));
  } catch {
    // Read-only disk: the check still runs, it just pays for the record again next time.
  }
}
