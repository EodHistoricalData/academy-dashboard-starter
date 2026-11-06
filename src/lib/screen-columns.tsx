import type { Column } from "@/components/DataTable";
import { ShortlistCell } from "@/components/Shortlist";
import { addToWatchlist } from "@/app/watchlist-actions";
import { toTicker } from "@/lib/added";
import { asPercent, compact, signedPercent } from "@/lib/format";
import type { ScreenRow } from "@/lib/screen-query";

/**
 * The screener's columns. Adding one is an entry here and nothing else: the table, the
 * dash for a missing value and the scrolling are already in DataTable.
 */
export const SCREEN_COLUMNS: Column<ScreenRow>[] = [
  { key: "code", label: "Code", render: (r) => r.code },
  { key: "name", label: "Name", render: (r) => r.name },
  {
    key: "adjusted_close",
    label: "Close",
    align: "right",
    // One exchange, one currency, but the symbol is on every row: the column says what it
    // is in, and there is no sort on price to rank a mix of scales.
    render: (r) => `${r.currency_symbol ?? ""}${r.adjusted_close.toFixed(2)}`,
  },
  {
    key: "refund_1d_p",
    label: "1d",
    align: "right",
    render: (r) => (r.refund_1d_p === null ? null : signedPercent(r.refund_1d_p)),
    tone: (r) =>
      r.refund_1d_p === null || r.refund_1d_p === 0
        ? null
        : r.refund_1d_p > 0
          ? "up"
          : "down",
  },
  {
    key: "market_capitalization",
    label: "Market cap",
    align: "right",
    render: (r) => compact(r.market_capitalization),
  },
  {
    key: "earnings_share",
    label: "EPS",
    align: "right",
    render: (r) =>
      r.earnings_share === null ? null : r.earnings_share.toFixed(2),
  },
  {
    key: "dividend_yield",
    label: "Yield",
    align: "right",
    // dividend_yield is a FRACTION: 0.0002 is 0.02%. asPercent is the only converter.
    render: (r) => (r.dividend_yield === null ? null : asPercent(r.dividend_yield)),
  },
  { key: "sector", label: "Sector", render: (r) => r.sector },
  {
    key: "shortlist",
    label: "",
    render: () => null,
    input: (r) => <ShortlistCell code={r.code} />,
  },
];

/**
 * The join between the two tools: from a result, onto the watchlist. Built per render,
 * because whether a name is already watched is known only then. It costs nothing here;
 * the watchlist pays one call per added name on each of its loads.
 */
export function watchlistColumn(watching: string[]): Column<ScreenRow> {
  return {
    key: "watchlist",
    label: "",
    render: () => null,
    input: (r) => {
      const ticker = toTicker(r);
      return watching.includes(ticker) ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">watching</span>
      ) : (
        <form action={addToWatchlist.bind(null, ticker)}>
          <button type="submit" className="text-xs underline underline-offset-2">
            Add to watchlist
          </button>
        </form>
      );
    },
  };
}
