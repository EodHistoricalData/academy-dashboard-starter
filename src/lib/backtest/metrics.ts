/** The change from the first point of an equity curve to the last. */
export function totalReturn(curve: number[]): number {
  return curve.length < 2 ? 0 : curve[curve.length - 1] / curve[0] - 1;
}

/**
 * The worst fall from a running peak, as a negative fraction. Against the running peak,
 * not the final value or the start, and on every point of the curve: a sampled curve never
 * sees the low it skipped.
 */
export function maxDrawdown(curve: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of curve) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

/**
 * The longest run of bars spent below a prior peak: how long you would have waited to be
 * back where you were. Depth and duration are different facts; a −55% that recovers in a
 * month and one that takes five years look the same in a max-drawdown column.
 * `from` and `to` index the curve; `recovered` is false when the run reaches the end.
 */
export function timeUnderWater(curve: number[]): {
  bars: number;
  from: number;
  to: number;
  recovered: boolean;
} {
  let peak = -Infinity;
  let best = { bars: 0, from: -1, to: -1, recovered: true };
  let start = -1;
  for (let i = 0; i < curve.length; i++) {
    if (curve[i] >= peak) {
      if (start >= 0 && i - start > best.bars) {
        best = { bars: i - start, from: start, to: i - 1, recovered: true };
      }
      peak = curve[i];
      start = -1;
    } else if (start < 0) {
      start = i;
    }
  }
  if (start >= 0 && curve.length - start > best.bars) {
    best = { bars: curve.length - start, from: start, to: curve.length - 1, recovered: false };
  }
  return best;
}

/** Total return over the depth of the worst drawdown. Not a Sharpe ratio, and not called one. */
export function returnOverDrawdown(curve: number[]): number | null {
  const dd = maxDrawdown(curve);
  return dd === 0 ? null : totalReturn(curve) / Math.abs(dd);
}

