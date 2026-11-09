import { type Column, DataTable } from "@/components/DataTable";
import { NoteField } from "@/components/NoteField";
import { currencyOf } from "@/lib/format";
import { isAvailable, type Row } from "@/lib/rows";

/**
 * The watchlist's columns. The table itself is the shared one in DataTable.tsx; what makes
 * this the watchlist is here: last price, the move since the previous close with its sign,
 * volume, and my note.
 */
/** The watchlist's data columns: what any surface showing these rows can use. */
export const PRICE_COLUMNS: Column<Row>[] = [
  { key: "code", label: "Ticker", render: (r) => r.code },
  {
    key: "close",
    label: "Last",
    align: "right",
    // With its currency: the list mixes exchanges, and London quotes in pence.
    render: (r) => (isAvailable(r) ? withUnit(fmt(r.close), currencyOf(r.code)) : null),
  },
  {
    key: "change",
    label: "Change",
    align: "right",
    // The sign carries the direction, so the meaning survives a colour-blind reader, a
    // bad screen and a greyscale print. Colour is the second signal.
    render: (r) =>
      isAvailable(r)
        ? `${signed(r.change)} (${signed(r.change_p)}%)`
        : "unavailable",
    tone: (r) =>
      !isAvailable(r) || r.change === 0 ? null : r.change > 0 ? "up" : "down",
  },
  {
    key: "volume",
    label: "Volume",
    align: "right",
    render: (r) =>
      isAvailable(r) && r.volume !== null
        ? r.volume.toLocaleString("en-US")
        : null,
  },
];

const COLUMNS: Column<Row>[] = [
  ...PRICE_COLUMNS,
  {
    key: "note",
    label: "Note",
    render: () => null,
    input: (r) => <NoteField code={r.code} />,
  },
];

/**
 * The watchlist itself, in the order it is handed (see SortedWatchlist). A ticker the API
 * had no prices for keeps its row, marked unavailable, and the line under the table says
 * what that means.
 */
export function Watchlist({ rows }: { rows: Row[] }) {
  const unavailable = rows.some((r) => !isAvailable(r));
  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.code}
        caption="Your watchlist: last price and change since the previous close."
        empty="Nothing to show."
      />
      {unavailable && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Unavailable: the API had no prices for that symbol. An unknown ticker,
          or one your plan does not cover.
        </p>
      )}
    </div>
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

const withUnit = (value: string, unit: string | null) => (unit ? `${value} ${unit}` : value);
