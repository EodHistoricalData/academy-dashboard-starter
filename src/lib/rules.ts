import type { Quote } from "@/lib/quotes";
import { isAvailable, type Row } from "@/lib/rows";

/**
 * A rule is data, not an `if`: it can be listed, shown and evaluated in one place.
 *
 *   { ticker: "AAPL.US", field: "change_p", op: "<", value: -3 }
 *   reads "tell me if Apple is down more than 3%".
 *
 * Rules are checked when the page renders, and only then. Nothing watches while the tab is
 * closed, a price can cross a threshold and come back between two loads unseen, and the
 * number compared is as old as the data's timestamp. The page says so beside the rules.
 */
export type Rule = {
  ticker: string;
  field: "change_p" | "close";
  op: ">" | "<";
  value: number;
};

/**
 * My rules. Kept here, in the repo, as data: one rule needs no editor, and the server
 * checks them on the same render that fetches the prices.
 */
export const RULES: Rule[] = [
  { ticker: "MSFT.US", field: "change_p", op: "<", value: -0.5 },
];

export function fires(rule: Rule, q: Quote): boolean {
  const actual = q[rule.field];
  return rule.op === ">" ? actual > rule.value : actual < rule.value;
}

/**
 * What fired, in a sentence that names the rule and the number. A row that turns red says
 * nothing you can act on, and colour alone fails a colour-blind reader.
 */
export function alertText(rule: Rule, q: Quote): string {
  if (rule.field === "change_p") {
    const move = `${q.change_p < 0 ? "down" : "up"} ${num(Math.abs(q.change_p))}%`;
    return `${q.code} ${move} — your rule was ${signed(rule.value)}%`;
  }
  const side = rule.op === ">" ? "above" : "below";
  return `${q.code} at ${q.close.toFixed(2)} — your rule was ${side} ${num(rule.value)}`;
}

/** Every rule that fires against this load's rows. A ticker without prices fires nothing. */
export function firedAlerts(
  rules: Rule[],
  rows: Row[],
): { rule: Rule; quote: Quote }[] {
  return rules.flatMap((rule) => {
    const quote = rows
      .filter(isAvailable)
      .find((r) => r.code === rule.ticker);
    return quote && fires(rule, quote) ? [{ rule, quote }] : [];
  });
}

function num(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}`;
}
