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

/** The share of bars that ended holding: what a comparison with buy and hold needs beside it. */
export const timeInMarket = (position: (0 | 1)[]) =>
  position.length === 0 ? 0 : position.reduce((held: number, p) => held + p, 0) / position.length;
