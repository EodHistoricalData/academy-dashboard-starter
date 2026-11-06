import type { Bar } from "@/lib/backtest/candles";

/** The two close columns, named, so nobody has to guess which one a number came from. */
export type CloseColumn = "adjusted_close" | "close";

/**
 * Daily returns as ratios, from the second bar on: the first has nothing before it, and
 * giving it a return shifts the whole curve by a day.
 *
 * Use "adjusted_close" for returns and signals. On raw close, Apple's four-for-one split on
 * 2020-08-31 reads as a −74.2% day that never happened.
 */
export function dailyReturns(
  bars: Bar[],
  column: CloseColumn,
): { date: string; r: number }[] {
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < bars.length; i++) {
    out.push({ date: bars[i].date, r: bars[i][column] / bars[i - 1][column] - 1 });
  }
  return out;
}

/**
 * An equity curve from returns, starting at 1. Multiplied, never added: −50% then +50% is
 * −25%, and summing would call it flat.
 */
export function compound(returns: number[]): number[] {
  const curve = [1];
  for (const r of returns) curve.push(curve[curve.length - 1] * (1 + r));
  return curve;
}

/** The n largest moves either way, biggest first. */
export function largestMoves(
  returns: { date: string; r: number }[],
  n: number,
): { date: string; r: number }[] {
  return [...returns].sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, n);
}

/** The splits endpoint sends the ratio as a string, "4.000000/1.000000". Null if not that shape. */
export function parseSplit(ratio: string): number | null {
  const m = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(ratio);
  if (!m) return null;
  const value = Number(m[1]) / Number(m[2]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
