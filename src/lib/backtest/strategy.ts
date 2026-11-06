import type { Bar } from "@/lib/backtest/candles";
import { signals } from "@/lib/backtest/signal";

/**
 * Every assumption of a run, in one place, printed beside its result. Cost sits with the
 * rule's own numbers on purpose: it is a stated assumption of the run, not a setting.
 */
export type Params = {
  fast: number;
  slow: number;
  /** Charged on every position change, both ways: 10 bps in, 10 bps out. */
  costBps: number;
};

/** Chosen from the rule's textbook form before looking at any result. */
export const DEFAULTS: Params = { fast: 20, slow: 50, costBps: 10 };

export type Trade = {
  entryDate: string;
  /** Raw close of the signal bar: what this unit's model fills at. */
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  /** On adjusted prices, after costs. */
  ret: number;
};

export type Run = {
  /** Dates from the first bar where the slow average exists. Both curves start here. */
  dates: string[];
  gross: number[];
  net: number[];
  /** Units held over each bar of the window: 0 or 1. */
  positions: (0 | 1)[];
  trades: Trade[];
  /** Share of the window's bars spent holding. */
  timeInMarket: number;
};

/**
 * Run the rule over the bars.
 *
 * Signals are computed on bar i; positions change on bar i+1. The return of bar i+1 (close
 * of i to close of i+1) is earned only if the signal at i said hold, which is the same as
 * filling at the signal bar's close. Do not line the two up on the same bar: that buys at
 * a price known only after the close.
 *
 * Costs are charged at each position change, against the balance at the time, never as a
 * total at the end and never for holding. An open position is closed, and charged, on the
 * last bar, or its return is never realised.
 */
export function backtest(bars: Bar[], params: Params): Run {
  const signal = signals(bars, params);
  const start = params.slow - 1;
  if (bars.length <= start) {
    return { dates: [], gross: [], net: [], positions: [], trades: [], timeInMarket: 0 };
  }

  const fee = 1 - params.costBps / 10_000;
  const dates = [bars[start].date];
  const gross = [1];
  const net = [1];
  const positions: (0 | 1)[] = [0];
  const trades: Trade[] = [];
  let open: { bar: number; equity: number } | null = null;
  let g = 1;
  let n = 1;

  for (let i = start + 1; i < bars.length; i++) {
    const held = positions[positions.length - 1];
    const wants = signal[i - 1] === true; // yesterday's close decides today's position
    let units: 0 | 1;

    if (held === 0 && !wants) {
      units = 0; // flat, no signal: nothing
    } else if (held === 0 && wants) {
      units = 1; // flat, signal: enter, at the signal bar's close
      open = { bar: i - 1, equity: n };
      n *= fee;
    } else if (held === 1 && wants) {
      units = 1; // held, signal: hold
    } else {
      units = 0; // held, no signal: exit, at the signal bar's close
      n *= fee;
      trades.push(closeTrade(bars, open!, i - 1, n));
      open = null;
    }

    const r = bars[i].adjusted_close / bars[i - 1].adjusted_close - 1;
    g *= 1 + units * r;
    n *= 1 + units * r;
    dates.push(bars[i].date);
    gross.push(g);
    positions.push(units);
    net.push(n);
  }

  const last = bars.length - 1;
  if (open) {
    n *= fee; // the open position is sold on the last bar
    net[net.length - 1] = n;
    trades.push(closeTrade(bars, open, last, n));
  }

  const held = positions.filter((p) => p === 1).length;
  return { dates, gross, net, positions, trades, timeInMarket: held / positions.length };
}

function closeTrade(
  bars: Bar[],
  open: { bar: number; equity: number },
  exitBar: number,
  equityAfter: number,
): Trade {
  return {
    entryDate: bars[open.bar].date,
    entryPrice: bars[open.bar].close,
    exitDate: bars[exitBar].date,
    exitPrice: bars[exitBar].close,
    // From the balance before the entry fee to the balance after the exit fee.
    ret: equityAfter / open.equity - 1,
  };
}
