/**
 * Signals are computed on bar i; positions change on bar i+1. A bar holds one unit when the
 * bar before it signalled, and nothing otherwise: lining the two up on the same bar would
 * buy at a price known only after the close.
 */
export const positions = (signal: (boolean | null)[]): (0 | 1)[] =>
  signal.map((_, i) => (i > 0 && signal[i - 1] === true ? 1 : 0));
