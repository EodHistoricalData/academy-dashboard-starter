import { ConfigError, DeliveryError } from "@/lib/alerts/deliver";
import { FetchError } from "@/lib/alerts/retry";
import { RuleError } from "@/lib/alerts/rules";

/**
 * Whether a run did its work, in one line. The workflow pings the heartbeat with it: success
 * only when it did, /fail with the reason when it did not. The reason goes to an outside
 * service, so it never carries a token or a price.
 */
export type Outcome = { ok: true } | { ok: false; reason: string };

export const OUTCOME_FILE = "alert-outcome.txt";

/** Weekdays after `from` up to and including `to`, both YYYY-MM-DD. Zero when `from` is not earlier. */
export function weekdaysBetween(from: string, to: string): number {
  const day = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  let count = 0;
  while (day < end) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) count++;
  }
  return count;
}

/**
 * Stale data, as a reason, or null. A symbol is stale when its newest bar is more than one
 * weekday behind the trading date: one day behind is a bar not ready yet or a holiday, two
 * is a feed that stopped (a delisted symbol, an expired key), and on day two it fails.
 */
export function staleness(
  symbols: string[],
  newest: Record<string, string>,
  today: string,
): string | null {
  const stale = symbols.flatMap((symbol) => {
    const date = newest[symbol];
    if (date === undefined) return [`${symbol} has no bar`];
    const behind = weekdaysBetween(date, today);
    return behind > 1 ? [`${symbol} newest bar ${date}, ${behind} weekdays behind ${today}`] : [];
  });
  return stale.length === 0 ? null : `stale data: ${stale.join("; ")}`;
}

/** What went wrong, in one line, from whatever stopped the run. */
export function failureReason(error: unknown): string {
  if (error instanceof RuleError) return `invalid rule: ${error.message}`;
  if (error instanceof ConfigError || error instanceof DeliveryError) {
    return `delivery error: ${error.message}`;
  }
  if (error instanceof FetchError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}
