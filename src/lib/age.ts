/**
 * How old a number is, from the response's own clock, not from the plan's name for it.
 *
 * The real-time endpoint's `timestamp` is Unix seconds, timezone-independent; `gmtoffset`
 * is for display and never enters arithmetic. It is the time of the last trade, not of the
 * request, so a thin instrument reports hours during an open market and is not broken.
 */
export const ageSeconds = (timestamp: number, now: number) =>
  Math.max(0, Math.floor(now / 1000) - timestamp); // Unix seconds; gmtoffset never enters

/**
 * The median gap between distinct consecutive timestamps: how often the number actually
 * changes, and so the fastest refresh that can show anything new. A repeated timestamp is
 * the same trade seen again, not a gap of zero.
 */
export function medianGap(timestamps: number[]): number | null {
  const distinct = [...new Set(timestamps)].sort((a, b) => a - b);
  const gaps = distinct
    .slice(1)
    .map((t, i) => t - distinct[i])
    .sort((a, b) => a - b);
  if (gaps.length === 0) return null;
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

export function describeAge(seconds: number): string {
  if (seconds < 60) return `${seconds} s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h old`;
  return `${Math.round(hours / 24)} days old`;
}
