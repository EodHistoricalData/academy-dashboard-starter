import type { Quote } from "@/lib/quotes";
import { evaluate, type Rule, type Verdict } from "@/lib/rules";

export type Checked = Verdict & {
  rule: Rule;
  /** The observation the rule was checked against, in the rule's own field. */
  value: number | null;
  checkedAt: number;
};

/**
 * Check every enabled rule against one fetch of their symbols. Time and fetching come in as
 * parameters: today the dashboard calls this while the page is open; a scheduler on a server
 * could call it tomorrow without a change. It reads no clock and imports no fetch.
 *
 * Guards (debounce, cooldown, hysteresis) are on unless switched off. `seen` holds the keys
 * of firings already delivered: the loop will run twice on the same data one day (a retry,
 * two tabs, an overlapping schedule), and a key already seen does not fire again.
 */
export async function checkAll(
  rules: Rule[],
  fetchQuotes: (symbols: string[]) => Promise<Quote[]>,
  now: number,
  opts: { guards?: boolean; seen?: Set<string> } = {},
): Promise<Checked[]> {
  const live = rules.filter((r) => r.enabled);
  if (live.length === 0) return [];
  const quotes = await fetchQuotes([...new Set(live.map((r) => r.ticker))]); // one request
  return live.map((rule) => {
    const quote = quotes.find((q) => q.code === rule.ticker);
    if (!quote) {
      return {
        rule,
        fires: false,
        nextLastValue: rule.lastValue,
        armed: rule.armed,
        heldLastCheck: rule.heldLastCheck,
        lastFiredAt: rule.lastFiredAt,
        key: null,
        value: null,
        checkedAt: now,
      };
    }
    const verdict = evaluate(rule, quote, { at: now, guards: opts.guards ?? true });
    const repeat = verdict.key !== null && opts.seen?.has(verdict.key);
    if (verdict.key !== null) opts.seen?.add(verdict.key);
    return {
      rule,
      ...verdict,
      fires: verdict.fires && !repeat,
      value: verdict.nextLastValue,
      checkedAt: now,
    };
  });
}

/** The rules with the state each check left: last value, armed, held, last fired. */
export function nextRules(rules: Rule[], checked: Checked[]): Rule[] {
  return rules.map((r) => {
    const c = checked.find((x) => x.rule.id === r.id);
    return c
      ? {
          ...r,
          lastValue: c.nextLastValue,
          armed: c.armed,
          heldLastCheck: c.heldLastCheck,
          lastFiredAt: c.lastFiredAt,
        }
      : r;
  });
}

/**
 * The firings of one window as one message, a line each: symbol, value, rule, UTC time.
 * "Your alert triggered" would make you open the app to find out what happened.
 */
export function digest(fired: Checked[]): string | null {
  const lines = fired
    .filter((c) => c.fires)
    .map((c) => {
      const { rule } = c;
      const crossing = rule.op === "crosses_above" || rule.op === "crosses_below";
      const dir = rule.op === ">" || rule.op === "crosses_above" ? "above" : "below";
      const what = crossing ? `crossed ${dir}` : `${dir}`;
      const time = new Date(c.checkedAt).toISOString().slice(11, 16);
      return `${rule.ticker} ${show(rule, c.value)}, ${what} ${show(rule, rule.value)}, ${time} UTC`;
    });
  return lines.length > 0 ? lines.join("\n") : null;
}

function show(rule: Rule, v: number | null): string {
  if (v === null) return "unknown";
  if (rule.field === "change_p") return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
  if (rule.field === "volume") return v.toLocaleString("en-US");
  return v.toFixed(2);
}
