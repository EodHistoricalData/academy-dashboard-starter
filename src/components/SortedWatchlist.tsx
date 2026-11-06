"use client";

import { Watchlist } from "@/components/Watchlist";
import type { Row } from "@/lib/rows";
import { SORT_KEYS, type SortKey, sortRows } from "@/lib/sort";
import { useStored, writeStored } from "@/lib/stored";

const SORT_KEY = "watchlist-sort-v1";

const LABELS: Record<SortKey, string> = {
  manual: "As written",
  change_p: "Change %",
  volume: "Volume",
};

/**
 * The client island that owns the sort control. The page stays a server component and
 * fetches the rows on the server; only the finished rows come here, so no key and no
 * request ever reach the browser.
 *
 * The choice is kept in localStorage: a sort that resets on every reload teaches you your
 * input does not stick.
 */
export function SortedWatchlist({
  rows,
  order,
}: {
  rows: Row[];
  /** The watchlist as written in src/lib/watchlist.ts. */
  order: string[];
}) {
  const stored = useStored(SORT_KEY);
  const key: SortKey = SORT_KEYS.includes(stored as SortKey)
    ? (stored as SortKey)
    : "manual";

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-end gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        Sort
        <select
          value={key}
          onChange={(e) => writeStored(SORT_KEY, e.target.value)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              {LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <Watchlist rows={sortRows(rows, key, order)} />
    </div>
  );
}
