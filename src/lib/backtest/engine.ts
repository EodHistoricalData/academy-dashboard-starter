import type { Bar } from "@/lib/backtest/candles";
import { signals } from "@/lib/backtest/strategy";

/**
 * Every assumption of a run, in one place, printed beside its result. Cost, slippage and
 * the fill rule sit with the rule's own numbers on purpose: they are stated assumptions of
 * the run, not settings.
 */
export type Params = {
  fast: number;
  slow: number;
  /** Fees, half the spread and impact, charged on every position change: in and out. */
  costBps: number;
  /** How much worse than the fill price you get, always against you. */
  slippageBps: number;
  /**
   * When a decision made at a bar's close is executed. "next-open" is the honest default:
   * the first price after the close you decided on. "signal-close" buys at a price known
   * only once the bar had closed, and is kept to show how much it flatters.
   */
  fill: "next-open" | "signal-close";
};

/** Chosen from the rule's textbook form and the course's cost default, before any result. */
export const DEFAULTS: Params = {
  fast: 20,
  slow: 50,
  costBps: 10,
  slippageBps: 5,
  fill: "next-open",
};

export type Trade = {
  entryDate: string;
  /** Raw price the entry was filled at, before slippage: the bar's open, or its close. */
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  /** On adjusted prices, after costs and slippage. */
  ret: number;
};

/** One execution, kept so a test can check it against the bar it happened on. */
export type Fill = {
  bar: number;
  price: number;
  side: "buy" | "sell";
  /** Which of the bar's prices it took: its open, or its close. */
  at: "open" | "close";
};

export type Run = {
  /** Dates from the first bar where the slow average exists. Both curves start here. */
  dates: string[];
  gross: number[];
  net: number[];
  /** Units held at the close of each bar of the window: 0 or 1. */
  positions: (0 | 1)[];
  signals: (boolean | null)[];
  trades: Trade[];
  fills: Fill[];
  /** Share of the window's bars that ended holding. */
  timeInMarket: number;
};

/**
 * Run the rule over the bars.
 *
 * Signals are computed on bar i; positions change on bar i+1. With "next-open" the change
 * happens at bar i+1's open: that bar earns open-to-close when entering and close-to-open
 * when leaving. With "signal-close" it happens at bar i's close, which needs a price nobody
 * had in time. Prices for fills are raw; returns are on the adjusted column, with the open
 * adjusted by the same factor as that bar's close.
 *
 * Costs and slippage are charged at each position change, against the balance at the time,
 * never as a total at the end and never for holding. An open position is closed, and
 * charged, at the last bar's close, or its return is never realised.
 */
export function backtest(bars: Bar[], params: Params): Run {
  const signal = signals(bars, params);
  const start = params.slow - 1;
  if (bars.length <= start) {
    return {
      dates: [],
      gross: [],
      net: [],
      positions: [],
      signals: [],
      trades: [],
      fills: [],
      timeInMarket: 0,
    };
  }

  const fee = 1 - (params.costBps + params.slippageBps) / 10_000;
  const adjOpen = (i: number) =>
    bars[i].open * (bars[i].adjusted_close / bars[i].close);
  const atOpen = params.fill === "next-open";

  const dates = [bars[start].date];
  const gross = [1];
  const net = [1];
  const positions: (0 | 1)[] = [0];
  const trades: Trade[] = [];
  const fills: Fill[] = [];
  let open: { bar: number; price: number; equity: number } | null = null;
  let g = 1;
  let n = 1;

  for (let i = start + 1; i < bars.length; i++) {
    const held = positions[positions.length - 1];
    const wants = signal[i - 1] === true; // yesterday's close decides today's position
    const prev = bars[i - 1].adjusted_close;
    const close = bars[i].adjusted_close;
    let units: 0 | 1;
    let gStep: number;
    let nStep: number;

    if (held === 0 && !wants) {
      units = 0; // flat, no signal: nothing
      gStep = nStep = 1;
    } else if (held === 0 && wants) {
      units = 1; // flat, signal: buy
      const bar = atOpen ? i : i - 1;
      const price = atOpen ? bars[i].open : bars[i - 1].close;
      fills.push({ bar, price, side: "buy", at: atOpen ? "open" : "close" });
      open = { bar, price, equity: n };
      gStep = atOpen ? close / adjOpen(i) : close / prev;
      nStep = fee * gStep;
    } else if (held === 1 && wants) {
      units = 1; // held, signal: hold
      gStep = nStep = close / prev;
    } else {
      units = 0; // held, no signal: sell
      const bar = atOpen ? i : i - 1;
      const price = atOpen ? bars[i].open : bars[i - 1].close;
      fills.push({ bar, price, side: "sell", at: atOpen ? "open" : "close" });
      gStep = atOpen ? adjOpen(i) / prev : 1;
      nStep = gStep * fee;
      trades.push(closeTrade(bars, open!, bar, price, n * nStep));
      open = null;
    }

    g *= gStep;
    n *= nStep;
    dates.push(bars[i].date);
    gross.push(g);
    net.push(n);
    positions.push(units);
  }

  const last = bars.length - 1;
  if (open) {
    // The open position is sold at the last bar's close.
    n *= fee;
    net[net.length - 1] = n;
    fills.push({ bar: last, price: bars[last].close, side: "sell", at: "close" });
    trades.push(closeTrade(bars, open, last, bars[last].close, n));
  }

  const held = positions.filter((p) => p === 1).length;
  return {
    dates,
    gross,
    net,
    positions,
    signals: signal.slice(start),
    trades,
    fills,
    timeInMarket: held / positions.length,
  };
}

function closeTrade(
  bars: Bar[],
  open: { bar: number; price: number; equity: number },
  exitBar: number,
  exitPrice: number,
  equityAfter: number,
): Trade {
  return {
    entryDate: bars[open.bar].date,
    entryPrice: open.price,
    exitDate: bars[exitBar].date,
    exitPrice,
    // From the balance before the entry fee to the balance after the exit fee.
    ret: equityAfter / open.equity - 1,
  };
}

/**
 * Costs in two numbers that settle arguments: what was paid as a share of starting equity,
 * and as a share of what the rule made before paying it.
 */
export function costShare(run: Run): { ofStart: number; ofGross: number | null } {
  const gross = (run.gross.at(-1) ?? 1) - 1;
  const net = (run.net.at(-1) ?? 1) - 1;
  const paid = gross - net;
  return { ofStart: paid, ofGross: gross > 0 ? paid / gross : null };
}

/**
 * The median overnight gap, previous close to next open, on the bars where the rule
 * filled, in basis points. When it is larger than the cost assumption, the cost model is
 * dominated by something it does not include.
 */
export function medianGapBps(bars: Bar[], run: Run): number | null {
  const gaps = run.fills
    .filter((f) => f.at === "open" && f.bar > 0)
    .map((f) => Math.abs(bars[f.bar].open / bars[f.bar - 1].close - 1) * 10_000)
    .sort((a, b) => a - b);
  if (gaps.length === 0) return null;
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}
