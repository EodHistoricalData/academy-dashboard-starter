import { SIGN_OFF, type Message } from "@/lib/alerts/deliver";
import type { Rule } from "@/lib/alerts/rules";
import type { State } from "@/lib/alerts/state";

/**
 * The Friday line that says the job is still watching. A working alert is quiet most days,
 * and a dead one is quiet too: this makes a quiet week visible, for no calls, since all of
 * it comes from alerts/state.json.
 */
export function isFriday(tradingDate: string): boolean {
  return new Date(`${tradingDate}T12:00:00Z`).getUTCDay() === 5;
}

/** The Monday of the week `date` (YYYY-MM-DD) falls in. */
function mondayOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function digestMessage(rules: Rule[], state: State, tradingDate: string): Message {
  const symbols = [...new Set(rules.map((r) => r.symbol))];
  const dates = symbols.map((s) => state.symbols[s]).filter((d): d is string => Boolean(d));
  const newest = dates.length > 0 ? dates.sort().at(-1) : "none yet";
  const monday = mondayOf(tradingDate);
  const thisWeek = Object.values(state.keys).filter(
    (k) => k.status === "sent" && k.sent !== null && k.sent >= monday && k.sent <= tradingDate,
  ).length;

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return {
    subject: "Price alert: still watching",
    text: [
      `Still watching ${plural(rules.length, "rule")} on ${plural(symbols.length, "symbol")}. ` +
        `Newest bar ${newest}. Alerts this week: ${thisWeek}.`,
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}
