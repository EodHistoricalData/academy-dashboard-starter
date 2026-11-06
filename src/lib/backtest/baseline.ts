import type { Bar } from "@/lib/backtest/bars";
import { compound, dailyReturns } from "@/lib/backtest/returns";

/**
 * The control: buy at the first bar, hold to the last. Every strategy is compared against
 * this, on the same bars and the same costs, so a result arrives with a comparison
 * attached.
 *
 * `gross` compounds adjusted returns from 1. `net` is the same curve after paying `costBps`
 * on the purchase and again on the sale at the end; it is drawn even at zero, so the gap is
 * on the chart from the first day a strategy trades.
 */
export function buyAndHold(
  bars: Bar[],
  costBps: number,
): { dates: string[]; gross: number[]; net: number[]; trades: number } {
  if (bars.length === 0) return { dates: [], gross: [], net: [], trades: 0 };
  const gross = compound(dailyReturns(bars, "adjusted_close").map((x) => x.r));
  const fee = 1 - costBps / 10_000;
  const net = gross.map((v, i) => v * fee * (i === gross.length - 1 && i > 0 ? fee : 1));
  return { dates: bars.map((b) => b.date), gross, net, trades: 1 };
}
