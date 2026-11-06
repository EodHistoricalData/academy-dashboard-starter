import { assertOldestFirst, type Bar } from "@/lib/backtest/candles";

/**
 * The rule, in one sentence: if the fast moving average of the adjusted close is above the
 * slow one at a bar's close, hold one unit from the next bar; otherwise hold nothing.
 */

/**
 * The mean of the `n` values ending at index `i`, inclusive. A window that ends at the bar
 * is honest; one centred on it reads the future. A window that would start before the
 * first bar throws, because `slice` with a negative start counts from the END of the
 * array and returns garbage that a leak test then cannot see.
 */
export function sma(values: number[], n: number, i: number): number {
  const window = values.slice(i - n + 1, i + 1);
  if (i - n + 1 < 0 || window.length !== n) {
    throw new Error(`short window at bar ${i}`);
  }
  return window.reduce((sum, v) => sum + v, 0) / n;
}

/**
 * The signal at every bar: true, false, or null where the slow average does not exist yet.
 * One pass, forwards; each bar reads only itself and earlier bars, so anything indexing
 * ahead of `i` would stand out.
 */
export function signals(
  bars: Bar[],
  params: { fast: number; slow: number },
): (boolean | null)[] {
  assertOldestFirst(bars);
  const adj = bars.map((b) => b.adjusted_close);
  const out: (boolean | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    out.push(
      i < params.slow - 1
        ? null
        : sma(adj, params.fast, i) > sma(adj, params.slow, i),
    );
  }
  return out;
}
