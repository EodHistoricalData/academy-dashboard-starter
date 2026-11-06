import { NoteField } from "@/components/NoteField";
import type { Quote } from "@/lib/quotes";
import { isAvailable, type Row as WatchlistRow } from "@/lib/rows";

/**
 * The watchlist itself: one row per ticker, ordered exactly as the learner wrote them in
 * src/lib/watchlist.ts. Deliberately not sorted by movement — a tool that reorders itself
 * by "biggest mover" is making a suggestion, and this one has no opinion.
 */
export function Watchlist({ rows }: { rows: WatchlistRow[] }) {
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
          <th scope="col" className="w-2/5 py-2 pl-6 text-left">
            Note
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) =>
          isAvailable(r) ? (
            <Row key={r.code} quote={r} />
          ) : (
            <UnavailableRow key={r.code} code={r.code} />
          ),
        )}
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
        {quote.volume === null ? "—" : quote.volume.toLocaleString("en-US")}
      </td>
      <td className="py-1.5 pl-6">
        <NoteField code={quote.code} />
      </td>
    </tr>
  );
}

/**
 * A ticker the API answered for with no prices: not a symbol it knows, or not one this
 * plan covers. It keeps its place in the list so the gap is visible, instead of the row
 * quietly disappearing.
 */
function UnavailableRow({ code }: { code: string }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <th
        scope="row"
        className="py-2.5 text-left font-medium text-zinc-900 dark:text-zinc-100"
      >
        {code}
      </th>
      <td colSpan={3} className="py-2.5 text-right text-zinc-500 dark:text-zinc-400">
        Unavailable: no prices for this symbol. Check the ticker, or whether
        your plan covers its exchange.
      </td>
      <td className="py-1.5 pl-6">
        <NoteField code={code} />
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
