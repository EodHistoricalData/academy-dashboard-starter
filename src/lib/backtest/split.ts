import type { Bar } from "@/lib/backtest/bars";
import { backtest, type Params, type Run } from "@/lib/backtest/strategy";
import { totalReturn } from "@/lib/backtest/metrics";

/**
 * In-sample, then out-of-sample once.
 *
 * The history is split by date before anything is tuned: the first 70% is for trying as
 * many parameter sets as you like, the rest is run once with the winner, and whatever it
 * gives is the result. Look at it, adjust, and look again, and it has become a second,
 * smaller in-sample period; only the run log would know.
 */

/** The parameter sets tried in-sample: fast × slow, costs and fills unchanged. */
export const GRID = { fast: [10, 15, 20, 25, 30], slow: [40, 50, 60] };

/**
 * The split, as a date written down before any run: 70% through the year of mock bars.
 * Yours is 70% through your own history. A date, not a share, so it cannot drift when the
 * history grows by a bar.
 */
export const SPLIT_DATE = "2026-07-16";

/** The index of the first out-of-sample bar: the first on or after SPLIT_DATE. */
export function splitIndex(bars: Bar[]): number {
  const at = bars.findIndex((b) => b.date >= SPLIT_DATE);
  return at === -1 ? bars.length : at;
}

/**
 * The best parameters on the in-sample bars only. Bars at or after `split` are never
 * passed in, so they cannot influence the choice.
 */
export function tune(
  bars: Bar[],
  split: number,
  base: Params,
): { best: Params; tried: { params: Params; net: number }[] } {
  const inSample = bars.slice(0, split);
  const tried = GRID.fast.flatMap((fast) =>
    GRID.slow
      .filter((slow) => fast < slow && slow <= inSample.length)
      .map((slow) => {
        const params = { ...base, fast, slow };
        return { params, net: totalReturn(backtest(inSample, params).net) };
      }),
  );
  const best = tried.reduce((a, b) => (b.net > a.net ? b : a)).params;
  return { best, tried };
}

/**
 * The one out-of-sample run: trading starts at the split. Signals may read bars before it,
 * which is history, not the future.
 */
export function outOfSample(bars: Bar[], params: Params, split: number): Run {
  return backtest(bars, params, { startAt: split });
}
