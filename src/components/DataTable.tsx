import type { ReactNode } from "react";
import { cell } from "@/lib/format";

/**
 * One column: how to turn a row into a cell. The table knows nothing else about the data.
 *
 * `render` returns text because formatting is where numbers get misrepresented, and one
 * function per column is one place to fix it. Null renders as a dash: a missing value is
 * not a zero, and printing 0.00 would invent a fact.
 */
export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => string | null;
  /** Up or down, for colour. Colour is the second signal; the text carries the sign. */
  tone?: (row: T) => "up" | "down" | null;
  /** A cell that holds a control instead of text: the watchlist's note. The table only
   *  places it. */
  input?: (row: T) => ReactNode;
};

/**
 * The table both products render through. What they share, and all this does: a header,
 * one row per record, right-aligned tabular figures, a dash for a missing value, an empty
 * state that says why, and sideways scrolling on a narrow screen rather than a page that
 * scrolls sideways. Nothing here mentions prices.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  onRowClick,
  selectedKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Clicking a row's first cell reports the row; the caller decides what that means. */
  onRowClick?: (row: T) => void;
  /** The row to mark as selected, by its key. */
  selectedKey?: string | null;
  /** Read by screen readers; the visible heading is the page's. */
  caption: string;
  /** Why there is nothing to show, in a sentence. */
  empty: ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse whitespace-nowrap text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3 py-2 first:pl-0 last:pr-0 ${alignOf(c)}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              aria-selected={onRowClick ? selectedKey === rowKey(row) : undefined}
              className="border-b border-zinc-100 last:border-0 aria-selected:bg-zinc-100 dark:border-zinc-900 dark:aria-selected:bg-zinc-800"
            >
              {columns.map((c, i) => {
                const className = `px-3 py-2.5 first:pl-0 last:pr-0 ${alignOf(c)} ${toneOf(c, row, i)}`;
                const text = c.input ? c.input(row) : cell(c.render(row));
                // The first cell is the row's button when rows can be picked, so a keyboard
                // reaches it and a screen reader announces it.
                const content =
                  i === 0 && onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      className="underline-offset-2 hover:underline"
                    >
                      {text}
                    </button>
                  ) : (
                    text
                  );
                // The first column names the row, for anyone listening to the table.
                return i === 0 ? (
                  <th key={c.key} scope="row" className={className}>
                    {content}
                  </th>
                ) : (
                  <td key={c.key} className={className}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function alignOf<T>(c: Column<T>): string {
  return c.align === "right" ? "text-right" : "text-left";
}

function toneOf<T>(c: Column<T>, row: T, index: number): string {
  const tone = c.tone?.(row);
  if (tone === "up") return "text-emerald-700 dark:text-emerald-400";
  if (tone === "down") return "text-red-700 dark:text-red-400";
  return index === 0
    ? "font-medium text-zinc-900 dark:text-zinc-100"
    : "text-zinc-700 dark:text-zinc-300";
}
