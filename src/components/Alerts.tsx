import type { Quote } from "@/lib/quotes";
import { alertText, type Rule } from "@/lib/rules";

/**
 * The rules that fired on this load, each as a sentence, and the line that says when rules
 * are checked. That line is the point: the worst outcome of this feature is someone
 * believing the tool watches for them while the tab is closed.
 */
export function Alerts({
  fired,
  ruleCount,
}: {
  fired: { rule: Rule; quote: Quote }[];
  ruleCount: number;
}) {
  if (ruleCount === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Rules
      </h2>
      {fired.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
          {fired.map(({ rule, quote }) => (
            <li key={`${rule.ticker}-${rule.field}-${rule.op}-${rule.value}`}>
              {alertText(rule, quote)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No rule fired on this load.
        </p>
      )}
      <p className="max-w-prose text-xs text-zinc-500 dark:text-zinc-400">
        Rules are checked when this page loads, against prices as old as the
        data age below. Nothing watches while the tab is closed, and a price
        that crosses a line and comes back between two loads is never seen.
      </p>
    </section>
  );
}
