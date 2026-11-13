import type { Bar } from "@/lib/backtest/candles";
import { parseSplit } from "@/lib/backtest/returns";

/** One row of /div, reduced to what the check needs. */
export type Dividend = {
  date: string;
  /**
   * The cash actually paid per share, in the share count of that day. Not `value`, which
   * is restated in today's shares: Apple's 2020-08-07 dividend is 0.82 here and 0.205 there.
   */
  unadjustedValue: number;
};

/** One row of /splits, its "4.000000/1.000000" read as a number. */
export type Split = { date: string; ratio: number };

/** A day on which the adjusted column moved by something other than what the record says. */
export type AdjustmentProblem = {
  date: string;
  /** The factor's step the dividends and splits predict for that day: 1 when nothing happened. */
  expected: number;
  /** The step the bars show. */
  found: number;
};

/**
 * How far a day's step may sit from the record and still match it: one part in ten
 * thousand, which real histories need (GE's before its 2021 reverse split wobbles by two in
 * a hundred thousand), plus the rounding of two adjusted closes in their fourth decimal,
 * which only matters for prices under a dollar. One quarter's dividend on an index fund is
 * about twenty-five times the floor, so a missed one still shows.
 */
export function tolerance(adjusted: number, previous: number): number {
  return 1e-4 + 1e-4 * (1 / adjusted + 1 / previous);
}

/**
 * The adjusted column, checked against the corporate actions that should have produced it.
 *
 * `adjusted_close / close` is the factor that day's price was multiplied by. Between two
 * events it does not move. On an ex-dividend day it steps up by 1 / (1 − D / previous
 * close), with D the cash paid; on a split day, by the split's ratio. A step anywhere else,
 * or a missing step where the record has an event, means the column was not produced by
 * these events: a cached history extended with fresh bars, two sources glued together, a
 * vendor that adjusts for splits only, or the two closes swapped.
 *
 * An event dated on a day with no bar is checked on the first bar after it: the step shows
 * there. Events dated on or before the first bar, or after the last, are outside the
 * history and ignored. A bar whose closes give no factor at all, a zero or a missing
 * price, is a problem in itself.
 */
export function auditAdjustments(
  bars: Bar[],
  dividends: Dividend[],
  splits: Split[],
): AdjustmentProblem[] {
  // The expected step on each bar, from every event that lands on it.
  const expected = bars.map(() => 1);
  const land = (date: string) => {
    if (bars.length < 2 || date <= bars[0].date) return -1;
    return bars.findIndex((b) => b.date >= date);
  };
  for (const s of splits) {
    const i = land(s.date);
    if (i > 0) expected[i] *= s.ratio;
  }
  for (const d of dividends) {
    const i = land(d.date);
    if (i > 0) expected[i] /= 1 - d.unadjustedValue / bars[i - 1].close;
  }

  const factor = (b: Bar) => b.adjusted_close / b.close;
  const usable = (b: Bar) => b.close > 0 && b.adjusted_close > 0 && Number.isFinite(factor(b));

  const problems: AdjustmentProblem[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { date } = bars[i];
    if (!usable(bars[i]) || !usable(bars[i - 1])) {
      problems.push({ date, expected: expected[i], found: Number.NaN });
      continue;
    }
    const found = factor(bars[i]) / factor(bars[i - 1]);
    const allowed = tolerance(bars[i].adjusted_close, bars[i - 1].adjusted_close);
    if (Math.abs(found / expected[i] - 1) > allowed) {
      problems.push({ date, expected: expected[i], found });
    }
  }
  return problems;
}

/** /div answers with a bare array. Rows without a date or a numeric unadjustedValue are dropped. */
export function toDividends(body: unknown): Dividend[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((item): Dividend[] => {
    const r = item as Record<string, unknown>;
    return typeof r?.date === "string" && typeof r.unadjustedValue === "number"
      ? [{ date: r.date, unadjustedValue: r.unadjustedValue }]
      : [];
  });
}

/** /splits answers with a bare array of { date, split: "4.000000/1.000000" }. */
export function toSplits(body: unknown): Split[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((item): Split[] => {
    const r = item as Record<string, unknown>;
    const ratio = typeof r?.split === "string" ? parseSplit(r.split) : null;
    return typeof r?.date === "string" && ratio !== null ? [{ date: r.date, ratio }] : [];
  });
}
