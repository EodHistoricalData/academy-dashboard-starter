import type { Quote } from "@/lib/quotes";

/**
 * The watchlist itself: one row per ticker, in the order it is handed. The page picks that
 * order and says which one it is; this component never reorders anything.
 */
export function Watchlist({ rows }: { rows: Quote[] }) {
  return (
    <table className="w-full border-collapse text-sm tabular-nums">
      <caption className="sr-only">
        Your watchlist: last price and change since the previous close.
      </caption>
      <thead>
        <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 dark:border-zinc-800">
          <th scope="col" className="py-2 text-left">
            Ticker
          </th>
          <th scope="col" className="py-2 text-right">
            Last
          </th>
          <th scope="col" className="py-2 text-right">
            Change
          </th>
          <th scope="col" className="hidden py-2 text-right sm:table-cell">
            Volume
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((q) => (
          <Row key={q.code} quote={q} />
        ))}
      </tbody>
    </table>
  );
}

function Row({ quote }: { quote: Quote }) {
  const up = quote.change > 0;
  const down = quote.change < 0;

  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <th
        scope="row"
        className="py-2.5 text-left font-medium text-zinc-900 dark:text-zinc-100"
      >
        {quote.code}
      </th>
      <td className="py-2.5 text-right text-zinc-900 dark:text-zinc-100">
        {fmt(quote.close)}
      </td>
      <td
        className={`py-2.5 text-right ${
          up
            ? "text-emerald-700 dark:text-emerald-400"
            : down
              ? "text-red-700 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {/* The sign carries the direction, so the meaning survives a colour-blind reader,
            a bad screen and a greyscale print. Colour is the second signal, never the
            only one. */}
        {signed(quote.change)}{" "}
        <span className="text-zinc-500 dark:text-zinc-400">
          ({signed(quote.change_p)}%)
        </span>
      </td>
      <td className="hidden py-2.5 text-right text-zinc-500 dark:text-zinc-400 sm:table-cell">
        {quote.volume.toLocaleString("en-US")}
      </td>
    </tr>
  );
}

/**
 * Two decimals, always. Prices that show a varying number of decimals do not line up in a
 * column, and a column of prices that does not line up is the one thing this page exists
 * to get right.
 */
function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
}
