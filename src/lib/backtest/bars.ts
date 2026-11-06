/**
 * A daily bar and how to read one, with nothing that touches the disk or the network, so
 * the backtest engine can run in the browser (the dashboard) as well as on the server.
 */
/**
 * One daily bar from /eod, oldest first.
 *
 * Two closes, kept apart on purpose: `close` is what printed that day; `adjusted_close` is
 * that price rewritten for every split and dividend since. Returns and signals use
 * adjusted; execution arithmetic (fills, prices paid) uses the raw open, high, low, close.
 */
export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  /** Raw: what printed. For fills. */
  close: number;
  /** Adjusted for splits and dividends since. For returns and signals. */
  adjusted_close: number;
  volume: number;
};

/**
 * /eod answers with a bare array (not the screener's `data` envelope). Every row is
 * narrowed, and the order is asserted: a series that arrives newest-first and is used as
 * it came silently reverses time.
 */
export function toBars(body: unknown): Bar[] {
  if (!Array.isArray(body)) return [];
  const bars = body.flatMap((item): Bar[] => {
    const r = item as Record<string, unknown>;
    const nums = ["open", "high", "low", "close", "adjusted_close", "volume"] as const;
    if (typeof r?.date !== "string" || nums.some((k) => typeof r[k] !== "number")) {
      return [];
    }
    return [
      {
        date: r.date,
        open: r.open as number,
        high: r.high as number,
        low: r.low as number,
        close: r.close as number,
        adjusted_close: r.adjusted_close as number,
        volume: r.volume as number,
      },
    ];
  });
  assertOldestFirst(bars);
  return bars;
}

export function assertOldestFirst(bars: Bar[]): void {
  if (bars.length > 1 && bars[0].date > bars[bars.length - 1].date) {
    throw new Error("bars must be oldest-first");
  }
}
