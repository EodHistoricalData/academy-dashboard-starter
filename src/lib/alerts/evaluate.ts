import type { Rule } from "@/lib/alerts/rules";

/** One daily bar from eod/SYMBOL: only the fields the alert reads. */
export type Bar = { date: string; close: number };

/**
 * Whether the last close crossed the rule's threshold, judged from the close before it.
 * Both come in the same end-of-day response, so a crossing needs no stored history.
 *
 * A close exactly on the line does not fire; the next close beyond it does, because the
 * one before was not beyond it. Fewer than two bars cannot show a crossing.
 */
export function evaluate(rule: Rule, bars: Bar[]): boolean {
  if (bars.length < 2) return false;
  const [prev, last] = bars.slice(-2);
  return rule.op === "crosses_above"
    ? prev.close <= rule.value && last.close > rule.value
    : prev.close >= rule.value && last.close < rule.value;
}
