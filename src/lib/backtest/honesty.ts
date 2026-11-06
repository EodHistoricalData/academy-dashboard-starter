import type { Bar } from "@/lib/backtest/candles";
import type { Run } from "@/lib/backtest/engine";

/**
 * Checks a backtest can run on itself. Three detect leaks; the shuffle is a null test for
 * time structure and detects no leak at all (a rule that reads tomorrow reads tomorrow's
 * shuffled return just as well). tests/honesty.test.ts runs all four.
 */

/** Fills that lie outside their bar's low-to-high range: impossible prices. */
export function fillsOutsideRange(bars: Bar[], run: Run): string[] {
  return run.fills
    .filter((f) => f.price < bars[f.bar].low || f.price > bars[f.bar].high)
    .map((f) => `${f.side} at ${f.price} on ${bars[f.bar].date}, range ${bars[f.bar].low}–${bars[f.bar].high}`);
}

/**
 * The same dates, with the daily returns put in a random order (a seeded shuffle, so a run
 * can be repeated). Each bar's open, high, low and close keep their shape relative to its
 * adjusted close; only the order of the moves changes.
 */
export function shuffled(bars: Bar[], seed: number): Bar[] {
  if (bars.length < 2) return bars;
  const ratios = bars.slice(1).map((b, i) => b.adjusted_close / bars[i].adjusted_close);
  const random = mulberry32(seed);
  for (let i = ratios.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ratios[i], ratios[j]] = [ratios[j], ratios[i]];
  }
  let level = bars[0].adjusted_close;
  return bars.map((b, i) => {
    if (i > 0) level *= ratios[i - 1];
    const scale = level / b.adjusted_close;
    return {
      ...b,
      open: b.open * scale,
      high: b.high * scale,
      low: b.low * scale,
      close: b.close * scale,
      adjusted_close: level,
    };
  });
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
