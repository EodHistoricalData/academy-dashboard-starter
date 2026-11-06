import type { Quote } from "@/lib/quotes";
import { evaluate, type Rule } from "@/lib/rules";

export type Checked = {
  rule: Rule;
  fires: boolean;
  nextLastValue: number | null;
  checkedAt: number;
};

/**
 * Check every enabled rule against one fetch of their symbols. Time and fetching come in as
 * parameters: today the dashboard calls this while the page is open; a scheduler on a server
 * could call it tomorrow without a change. It reads no clock and imports no fetch.
 */
export async function checkAll(
  rules: Rule[],
  fetchQuotes: (symbols: string[]) => Promise<Quote[]>,
  now: number,
): Promise<Checked[]> {
  const live = rules.filter((r) => r.enabled);
  if (live.length === 0) return [];
  const quotes = await fetchQuotes([...new Set(live.map((r) => r.ticker))]); // one request
  return live.map((rule) => {
    const quote = quotes.find((q) => q.code === rule.ticker);
    const verdict = quote
      ? evaluate(rule, quote)
      : { fires: false, nextLastValue: rule.lastValue };
    return { rule, ...verdict, checkedAt: now };
  });
}
