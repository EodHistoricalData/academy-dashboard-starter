import type { Bar } from "@/lib/backtest/candles";
import type { Params } from "@/lib/backtest/params";
import { signals } from "@/lib/backtest/signal";

/**
 * The same backtest, written a second way, to check the first.
 *
 * strategy.ts walks the bars as a state machine: flat or holding, buy, hold, sell. This
 * cuts every day into two pieces instead, the night (previous close to this open) and the
 * day (this open to this close), and asks one question of each piece: was a unit held
 * through it? A piece held earns its move on adjusted prices; a piece not held earns
 * nothing. Every change of position pays the fee once, and a position still open at the
 * last bar pays it once more, as if sold at that close.
 *
 * It was written from that paragraph without reading strategy.ts, so a mistake in one is
 * unlikely to be repeated in the other. The two share the signal and nothing else; the
 * leak tests already pin the signal. tests/twin.test.ts holds them to the same curves.
 */
export function twin(
  bars: Bar[],
  params: Params,
): { dates: string[]; gross: number[]; net: number[] } {
  const start = params.slow - 1;
  if (bars.length <= start) return { dates: [], gross: [], net: [] };

  const signal = signals(bars, params);
  const fee = 1 - (params.costBps + params.slippageBps) / 10_000;
  // The unit held at the close of bar i: decided at the close before, flat on the first bar.
  const held = (i: number) => (i > start && signal[i - 1] === true ? 1 : 0);
  // An open on the adjusted scale: the raw open times that day's adjustment factor.
  const adjustedOpen = (b: Bar) => b.open * (b.adjusted_close / b.close);

  const dates = [bars[start].date];
  const gross = [1];
  const net = [1];
  let changes = 0;
  for (let i = start + 1; i < bars.length; i++) {
    const before = held(i - 1);
    const after = held(i);
    const night = adjustedOpen(bars[i]) / bars[i - 1].adjusted_close;
    const day = bars[i].adjusted_close / adjustedOpen(bars[i]);
    // At the next open, the night belongs to the old position and the day to the new one.
    // At the signal's close, the change happened the evening before: the whole day is new.
    const step =
      params.fill === "next-open"
        ? (before ? night : 1) * (after ? day : 1)
        : after
          ? night * day
          : 1;
    if (before !== after) changes++;
    const g = gross[gross.length - 1] * step;
    dates.push(bars[i].date);
    gross.push(g);
    // Net is gross with one fee for every change so far: costs are paid, never earned back.
    net.push(g * fee ** changes);
  }

  if (held(bars.length - 1)) net[net.length - 1] *= fee;
  return { dates, gross, net };
}
