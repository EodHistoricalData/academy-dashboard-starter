import { isAvailable, type Row } from "@/lib/rows";

/**
 * The orders the watchlist offers. Each one is an opinion about what deserves attention:
 *
 *   manual    my own priority; hides today's outliers
 *   change_p  what moved most, up or down; hides anything stable
 *   volume    where the activity is; hides thin names doing something unusual
 *
 * There is no sort by absolute `change` on purpose: that mostly sorts by share price.
 */
export type SortKey = "manual" | "change_p" | "volume";

export const SORT_KEYS: readonly SortKey[] = ["manual", "change_p", "volume"];

/**
 * The rows in the chosen order. Never sorts the array it is handed (`.sort()` mutates in
 * place, and other code holds the same array).
 *
 * Manual order is rebuilt from `order`, my list, because the API does not promise to
 * answer in the order it was asked.
 *
 * Ties are broken by ticker. `sort` is stable, which only means tied rows keep the order
 * they arrived in, and the API does not promise that order either: without the tie-break
 * two names both up 0.32% swap places between reloads.
 *
 * Rows without prices cannot be ranked, so they go last, by ticker.
 */
export function sortRows(rows: Row[], key: SortKey, order: string[]): Row[] {
  if (key === "manual") {
    return order
      .map((code) => rows.find((r) => r.code === code))
      .filter((r): r is Row => Boolean(r));
  }

  const priced = rows.filter(isAvailable);
  const unpriced = rows.filter((r) => !isAvailable(r));
  const value = (r: (typeof priced)[number]) =>
    key === "volume" ? (r.volume ?? -1) : Math.abs(r.change_p);

  // filter() has already copied, so these sorts touch nothing the caller holds.
  return [
    ...priced.sort(
      (a, b) => value(b) - value(a) || a.code.localeCompare(b.code),
    ),
    ...unpriced.sort((a, b) => a.code.localeCompare(b.code)),
  ];
}
